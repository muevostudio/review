"""
Muevo Review · conversor de prévias

Roda como um Cloud Run Job. Cada execução converte UM vídeo:
  1. lê o original direto do Google Drive (sem baixar inteiro antes)
  2. cria uma versão leve em MP4 (H.264, até 1080p, mesmo fps do original)
  3. salva essa versão na pasta de prévias do Drive, com acesso "qualquer pessoa com o link"
  4. avisa o Apps Script que terminou (ou que deu erro)

O original nunca é copiado nem guardado: o ffmpeg lê do Drive em pedaços.

Variáveis recebidas a cada execução (o Apps Script manda):
  FILE_ID       id do original no Drive
  DRIVE_TOKEN   token de acesso ao Drive da conta da Muevo (vale 1 hora)
  JOB_TOKEN     token do link de revisão
  CALLBACK_URL  endereço do Apps Script
  SEGREDO       senha combinada com o Apps Script
  PASTA_ID      pasta do Drive onde a prévia é salva
  NOME          nome do arquivo da prévia
"""
import json, os, re, subprocess, sys, threading, time, urllib.request, urllib.error


class SemRedirecionar(urllib.request.HTTPRedirectHandler):
    # o Apps Script grava e depois redireciona só para mostrar a resposta: não precisamos seguir
    def redirect_request(self, *a, **k):
        return None


SEM_REDIR = urllib.request.build_opener(SemRedirecionar)

API = os.environ.get("DRIVE_API", "https://www.googleapis.com")
SAIDA = "/tmp/previa.mp4"
LADO_MAX = int(os.environ.get("LADO_MAX", "1920"))


def env(nome, obrig=True):
    v = os.environ.get(nome, "").strip()
    if obrig and not v:
        raise SystemExit("faltando " + nome)
    return v


FILE_ID, TOKEN, JOB, CALLBACK, SEGREDO = (env("FILE_ID"), env("DRIVE_TOKEN"), env("JOB_TOKEN"),
                                          env("CALLBACK_URL"), env("SEGREDO"))
QUOTA = env("QUOTA_PROJETO", False)
PASTA, NOME = env("PASTA_ID", False), env("NOME", False) or ("previa-" + JOB + ".mp4")


def req(metodo, url, corpo=None, cab=None, bruto=False):
    cab = dict(cab or {})
    cab["Authorization"] = "Bearer " + TOKEN
    if QUOTA:
        cab["X-Goog-User-Project"] = QUOTA
    dados = corpo
    if isinstance(corpo, (dict, list)):
        dados = json.dumps(corpo).encode()
        cab["Content-Type"] = "application/json; charset=UTF-8"
    r = urllib.request.Request(url, data=dados, method=metodo, headers=cab)
    with urllib.request.urlopen(r, timeout=120) as resp:
        return resp if bruto else json.loads(resp.read() or b"{}")


def avisa(acao, **extra):
    corpo = dict(acao=acao, token=JOB, segredo=SEGREDO, **extra)
    for tentativa in range(3):
        try:
            r = urllib.request.Request(CALLBACK, data=json.dumps(corpo).encode(), method="POST",
                                       headers={"Content-Type": "text/plain;charset=utf-8"})
            SEM_REDIR.open(r, timeout=60).read()
            return
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307):
                return
        except Exception:
            pass
        time.sleep(3 * (tentativa + 1))


def avisa_depois(acao, **extra):
    # progresso vai em paralelo, para nunca segurar a conversão
    threading.Thread(target=avisa, args=(acao,), kwargs=extra, daemon=True).start()


def duracao_de(caminho_ou_url, cab=None):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height,codec_type,r_frame_rate",
           "-of", "json"]
    if cab:
        cmd += ["-headers", cab]
    cmd.append(caminho_ou_url)
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    try:
        return json.loads(out.stdout or "{}")
    except ValueError:
        return {}


def converte(origem, cab, total):
    filtro = (f"scale=w='min({LADO_MAX},iw)':h='min({LADO_MAX},ih)':force_original_aspect_ratio=decrease:"
              "force_divisible_by=2,format=yuv420p")
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
           "-headers", cab, "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "10",
           "-i", origem,
           "-map", "0:v:0", "-map", "0:a:0?", "-vf", filtro,
           "-c:v", "libx264", "-preset", os.environ.get("PRESET", "veryfast"), "-crf", "20",
           "-maxrate", "8M", "-bufsize", "16M", "-profile:v", "high",
           # um quadro-chave por segundo: pular para qualquer ponto do vídeo fica rápido
           "-force_key_frames", "expr:gte(t,n_forced*1)",
           "-c:a", "aac", "-b:a", "160k", "-ac", "2",
           "-movflags", "+faststart", "-progress", "pipe:1", "-nostats", SAIDA]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    ultimo = 0.0
    for linha in p.stdout:
        m = re.match(r"out_time_us=(\d+)", linha.strip())
        if m and total > 0 and time.time() - ultimo > 15:
            ultimo = time.time()
            avisa_depois("previa_progresso", pct=min(99, int(int(m.group(1)) / 1e6 / total * 100)))
    p.wait()
    if p.returncode != 0:
        raise RuntimeError("ffmpeg: " + p.stderr.read()[-500:])


def envia(caminho):
    meta = {"name": NOME, "mimeType": "video/mp4"}
    if PASTA:
        meta["parents"] = [PASTA]
    tam = os.path.getsize(caminho)
    r = req("POST", API + "/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true", meta,
            {"X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(tam)}, bruto=True)
    destino = r.headers["Location"]
    with open(caminho, "rb") as f:
        r = urllib.request.Request(destino, data=f, method="PUT",
                                   headers={"Content-Length": str(tam), "Content-Type": "video/mp4"})
        arq = json.loads(urllib.request.urlopen(r, timeout=1800).read())
    # o player do site lê a prévia com a chave pública do Google, então ela precisa estar aberta para quem tem o link
    req("POST", API + "/drive/v3/files/" + arq["id"] + "/permissions?supportsAllDrives=true",
        {"role": "reader", "type": "anyone"})
    return arq["id"]


def main():
    inicio = time.time()
    origem = API + "/drive/v3/files/" + FILE_ID + "?alt=media&supportsAllDrives=true"
    cab = "Authorization: Bearer " + TOKEN + "\r\n" + ("X-Goog-User-Project: " + QUOTA + "\r\n" if QUOTA else "")
    info = duracao_de(origem, cab)
    total = float((info.get("format") or {}).get("duration") or 0)
    if not info.get("streams"):
        raise RuntimeError("nao_e_video")
    avisa("previa_progresso", pct=1)
    converte(origem, cab, total)
    saida = duracao_de(SAIDA)
    v = next((s for s in saida.get("streams", []) if s.get("codec_type") == "video"), {})
    fps = 24.0
    try:
        a, b = (v.get("r_frame_rate") or "24/1").split("/")
        fps = round(float(a) / float(b), 3)
    except Exception:
        pass
    previa = envia(SAIDA)
    original = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
    avisa("previa_pronta", previa=previa,
          duracao=round(float((saida.get("format") or {}).get("duration") or total), 2), fps=fps,
          resolucao=f"{original.get('width', '')}×{original.get('height', '')}" if original.get("width") else "",
          segundos=round(time.time() - inicio))
    print(f"pronto em {time.time() - inicio:.0f}s: {previa}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        avisa("previa_erro", erro=str(e)[:300])
        print("erro:", e, file=sys.stderr)
        sys.exit(1)
