"""
Muevo Review · conversor de prévias

Roda como um Cloud Run Job. Cada execução converte UM vídeo (ou um PDF em imagens de página, com TIPO=pdf):
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

Guardar as prévias no Cloudflare R2 (recomendado; fica na configuração do job, não muda a cada execução):
  R2_CONTA      id da conta Cloudflare
  R2_CHAVE      Access Key ID do token do R2
  R2_SEGREDO    Secret Access Key do token do R2
  R2_BALDE      nome do bucket (ex.: muevo-previas)
  R2_PUBLICO    endereço público do bucket (ex.: https://pub-xxxx.r2.dev)
Sem essas variáveis, a prévia continua indo para a pasta do Drive.
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
R2 = {k: env("R2_" + k, False) for k in ("CONTA", "CHAVE", "SEGREDO", "BALDE", "PUBLICO")}
USA_R2 = all(R2.values())
# nome dos arquivos no R2: token do link + um carimbo (cada conversão gera um endereço novo, sem cache velho)
BASE_R2 = f"previas/{JOB}-{int(time.time())}"


_S3 = {}


def s3():
    if "c" not in _S3:
        import boto3
        from botocore.config import Config
        _S3["c"] = boto3.client("s3", endpoint_url=os.environ.get("R2_ENDPOINT") or f"https://{R2['CONTA']}.r2.cloudflarestorage.com",
                                aws_access_key_id=R2["CHAVE"], aws_secret_access_key=R2["SEGREDO"], region_name="auto",
                                config=Config(retries={"max_attempts": 6, "mode": "standard"}, signature_version="s3v4"))
    return _S3["c"]


# o original fica no R2 só enquanto converte (e para novas tentativas); depois de pronto, é apagado
CHAVE_ORIG = f"originais/{JOB}"


def original_no_r2():
    try:
        return int(s3().head_object(Bucket=R2["BALDE"], Key=CHAVE_ORIG).get("ContentLength") or 0) > 0
    except Exception:
        return False


def traz_para_r2():
    """1º passo: copia o original do Drive para o R2, no tamanho original, sem converter nada.
    É o único momento em que o Drive é acessado. Se já estiver no R2 (nova tentativa), não baixa de novo."""
    if original_no_r2():
        print("original já está no R2; não precisa baixar do Drive", file=sys.stderr)
        return
    from boto3.s3.transfer import TransferConfig
    esperas = [30, 90]
    for i in range(len(esperas) + 1):
        try:
            url = origem_drive()
            resp = req("GET", url, bruto=True)
            total = int(resp.headers.get("Content-Length") or 0)
            enviado = {"n": 0, "t": 0.0}

            def andou(n):
                enviado["n"] += n
                if total and time.time() - enviado["t"] > 10:
                    enviado["t"] = time.time()
                    avisa_depois("previa_progresso", pct=1 + int(enviado["n"] / total * 19))   # cópia: 1% a 20%

            s3().upload_fileobj(resp, R2["BALDE"], CHAVE_ORIG, Callback=andou,
                                Config=TransferConfig(multipart_chunksize=64 * 1024 * 1024, max_concurrency=4))
            print(f"original copiado para o R2: {enviado['n'] / 1e6:.0f} MB", file=sys.stderr)
            return
        except Exception as e:
            motivo = str(e)
            print(f"cópia Drive → R2 falhou (tentativa {i + 1}): {motivo[:300]}", file=sys.stderr)
            if i == len(esperas) or re.search(r"insufficient|notFound|appNotAuthorized|authError", motivo):
                raise RuntimeError("não consegui copiar o original do Drive: " + motivo[:250])
            time.sleep(esperas[i])


def url_original_r2():
    return s3().generate_presigned_url("get_object", Params={"Bucket": R2["BALDE"], "Key": CHAVE_ORIG}, ExpiresIn=6 * 3600)


def apaga_original_r2():
    try:
        s3().delete_object(Bucket=R2["BALDE"], Key=CHAVE_ORIG)
        print("original apagado do R2", file=sys.stderr)
    except Exception as e:
        print("original não apagado do R2:", e, file=sys.stderr)


def envia_r2(caminho, chave, tipo):
    s3().upload_file(caminho, R2["BALDE"], chave,
                   ExtraArgs={"ContentType": tipo, "CacheControl": "public, max-age=31536000, immutable"})
    return R2["PUBLICO"].rstrip("/") + "/" + chave


def capa(origem_video, destino):
    # um quadro do começo do vídeo, para aparecer antes do play
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "1", "-i", origem_video,
                    "-frames:v", "1", "-vf", "scale='min(1920,iw)':-2", "-q:v", "3", destino],
                   capture_output=True, timeout=120)
    return os.path.exists(destino) and os.path.getsize(destino) > 0


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
    try:
        resp = urllib.request.urlopen(r, timeout=120)
    except urllib.error.HTTPError as e:
        # devolve o motivo que o Google deu (o "403 Forbidden" sozinho não diz nada)
        try:
            erro = json.loads(e.read() or b"{}").get("error", {})
            razoes = ",".join(x.get("reason", "") for x in erro.get("errors", []))
            detalhe = f"{razoes} {erro.get('message', '')}".strip()
        except Exception:
            detalhe = ""
        onde = url.split("?")[0].replace(API, "")
        raise RuntimeError(f"{metodo} {onde}: {e.code} {detalhe}"[:300]) from None
    if bruto:
        return resp
    with resp:
        return json.loads(resp.read() or b"{}")


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


def motivo_drive(origem):
    """Pergunta ao Drive por que recusou (o ffmpeg só mostra "403")."""
    try:
        req("GET", origem, cab={"Range": "bytes=0-0"}, bruto=True).read()
        return ""
    except urllib.error.HTTPError as e:
        try:
            erro = json.loads(e.read() or b"{}").get("error", {})
            razoes = ",".join(x.get("reason", "") for x in erro.get("errors", []))
            return f"{e.code} {razoes} {erro.get('message', '')}".strip()
        except Exception:
            return str(e.code)
    except Exception as e:
        return str(e)[:300]


def converte_com_paciencia(origem, cab, total):
    # o Drive às vezes recusa por alguns minutos arquivos grandes (muito acessados ou recém-enviados): espera e tenta de novo
    esperas = [30, 60, 120, 240]
    for i in range(len(esperas) + 1):
        try:
            return converte(origem, cab, total)
        except RuntimeError as e:
            if "403" not in str(e) and "429" not in str(e) and "500" not in str(e) and "503" not in str(e):
                raise
            motivo = motivo_drive(origem)
            print(f"drive recusou (tentativa {i + 1}): {motivo}", file=sys.stderr)
            if "downloadQuota" in motivo and not COPIA["id"]:
                origem = origem_drive()   # passou do limite no meio: segue pela cópia temporária
                continue
            if i == len(esperas) or re.search(r"insufficient|notFound|appNotAuthorized|authError", motivo):
                raise RuntimeError("drive recusou o arquivo: " + (motivo or str(e))[-300:])
            avisa_depois("previa_progresso", pct=1)
            time.sleep(esperas[i])


def converte(origem, cab, total, pct0=0):
    filtro = (f"scale=w='min({LADO_MAX},iw)':h='min({LADO_MAX},ih)':force_original_aspect_ratio=decrease:"
              "force_divisible_by=2,format=yuv420p")
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"] + (["-headers", cab] if cab else []) + [
           "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "10",
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
            feito = min(1.0, int(m.group(1)) / 1e6 / total)
            avisa_depois("previa_progresso", pct=min(99, int(pct0 + feito * (99 - pct0))))
    p.wait()
    if p.returncode != 0:
        raise RuntimeError("ffmpeg: " + p.stderr.read()[-500:])


def envia(caminho, nome=None, tipo="video/mp4"):
    meta = {"name": nome or NOME, "mimeType": tipo}
    if PASTA:
        meta["parents"] = [PASTA]
    tam = os.path.getsize(caminho)
    r = req("POST", API + "/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true", meta,
            {"X-Upload-Content-Type": tipo, "X-Upload-Content-Length": str(tam)}, bruto=True)
    destino = r.headers["Location"]
    with open(caminho, "rb") as f:
        r = urllib.request.Request(destino, data=f, method="PUT",
                                   headers={"Content-Length": str(tam), "Content-Type": tipo})
        arq = json.loads(urllib.request.urlopen(r, timeout=1800).read())
    # o player do site lê a prévia com a chave pública do Google, então ela precisa estar aberta para quem tem o link
    req("POST", API + "/drive/v3/files/" + arq["id"] + "/permissions?supportsAllDrives=true",
        {"role": "reader", "type": "anyone"})
    return arq["id"]


def baixa(origem, destino):
    cab = {"Authorization": "Bearer " + TOKEN}
    if QUOTA:
        cab["X-Goog-User-Project"] = QUOTA
    with urllib.request.urlopen(urllib.request.Request(origem, headers=cab), timeout=600) as r, open(destino, "wb") as f:
        while True:
            pedaco = r.read(1 << 20)
            if not pedaco:
                break
            f.write(pedaco)


COPIA = {"id": ""}


def origem_drive():
    """Endereço para ler o original. Se o Drive disser que o arquivo passou do limite de downloads do dia
    (downloadQuotaExceeded), faz uma cópia temporária dentro do próprio Drive (não conta como download)
    e lê da cópia. A cópia é apagada no fim."""
    url = API + "/drive/v3/files/" + FILE_ID + "?alt=media&supportsAllDrives=true"
    motivo = motivo_drive(url)
    if not motivo:
        return url
    if "downloadQuota" not in motivo and "cannotDownload" not in motivo:
        # outro tipo de recusa (permissão, limite de uso da conta etc.): espera um pouco e confere de novo antes de desistir
        for espera in (20, 60):
            time.sleep(espera)
            motivo = motivo_drive(url)
            if not motivo:
                return url
        raise RuntimeError("drive recusou o original: " + motivo)
    print("limite de download do original; usando uma cópia temporária", file=sys.stderr)
    corpo = {"name": "_temp conversor " + JOB}
    if PASTA:
        corpo["parents"] = [PASTA]
    copia = req("POST", API + "/drive/v3/files/" + FILE_ID + "/copy?supportsAllDrives=true&fields=id", corpo)
    COPIA["id"] = copia["id"]
    return API + "/drive/v3/files/" + copia["id"] + "?alt=media&supportsAllDrives=true"


def apaga_copia():
    if COPIA["id"]:
        try:
            req("DELETE", API + "/drive/v3/files/" + COPIA["id"] + "?supportsAllDrives=true", bruto=True).read()
        except Exception as e:
            print("cópia temporária não apagada:", e, file=sys.stderr)


def pdf():
    """PDF: cada página vira uma imagem JPG (até 2000 px no lado maior), salva na pasta de prévias."""
    inicio = time.time()
    if USA_R2:
        traz_para_r2()
        s3().download_file(R2["BALDE"], CHAVE_ORIG, "/tmp/original.pdf")
    else:
        baixa(origem_drive(), "/tmp/original.pdf")
    avisa("previa_progresso", pct=5)
    os.makedirs("/tmp/pag", exist_ok=True)
    p = subprocess.run(["pdftoppm", "-jpeg", "-jpegopt", "quality=88", "-scale-to", "2000", "-l", "300",
                        "/tmp/original.pdf", "/tmp/pag/p"], capture_output=True, text=True, timeout=1800)
    paginas_arq = sorted(f for f in os.listdir("/tmp/pag") if f.endswith(".jpg"))
    if not paginas_arq:
        raise RuntimeError("pdf: " + (p.stderr or "nenhuma página")[-300:])
    base = re.sub(r"\.mp4$", "", NOME)
    ids = []
    for i, f in enumerate(paginas_arq):
        if USA_R2:
            ids.append(envia_r2("/tmp/pag/" + f, f"{BASE_R2}/p{i + 1:03d}.jpg", "image/jpeg"))
        else:
            ids.append(envia("/tmp/pag/" + f, f"{base} p{i + 1:03d}.jpg", "image/jpeg"))
        avisa_depois("previa_progresso", pct=min(99, 5 + int((i + 1) / len(paginas_arq) * 94)))
    avisa("previa_pronta", previa=ids[0], paginas=ids, segundos=round(time.time() - inicio))
    if USA_R2:
        apaga_original_r2()
    print(f"pdf pronto em {time.time() - inicio:.0f}s: {len(ids)} páginas")


def main():
    if os.environ.get("TIPO", "video").strip() == "pdf":
        return pdf()
    inicio = time.time()
    avisa("previa_progresso", pct=1)
    if USA_R2:
        # 1) Drive → R2 (uma vez só)   2) converte a partir do R2
        traz_para_r2()
        origem, cab = url_original_r2(), ""
    else:
        origem = origem_drive()
        cab = "Authorization: Bearer " + TOKEN + "\r\n" + ("X-Goog-User-Project: " + QUOTA + "\r\n" if QUOTA else "")
    info = duracao_de(origem, cab)
    total = float((info.get("format") or {}).get("duration") or 0)
    if not info.get("streams"):
        raise RuntimeError("nao_e_video (o arquivo não parece ser um vídeo)")
    if USA_R2:
        converte(origem, cab, total, pct0=20)
    else:
        converte_com_paciencia(origem, cab, total)
    saida = duracao_de(SAIDA)
    v = next((s for s in saida.get("streams", []) if s.get("codec_type") == "video"), {})
    fps = 24.0
    try:
        a, b = (v.get("r_frame_rate") or "24/1").split("/")
        fps = round(float(a) / float(b), 3)
    except Exception:
        pass
    if USA_R2:
        previa = envia_r2(SAIDA, BASE_R2 + ".mp4", "video/mp4")
        if capa(SAIDA, "/tmp/capa.jpg"):
            try:
                envia_r2("/tmp/capa.jpg", BASE_R2 + ".jpg", "image/jpeg")
            except Exception as e:
                print("capa não enviada:", e, file=sys.stderr)
    else:
        previa = envia(SAIDA)
    original = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
    avisa("previa_pronta", previa=previa,
          duracao=round(float((saida.get("format") or {}).get("duration") or total), 2), fps=fps,
          resolucao=f"{original.get('width', '')}×{original.get('height', '')}" if original.get("width") else "",
          segundos=round(time.time() - inicio))
    if USA_R2:
        apaga_original_r2()   # a versão leve está pronta: o original pesado sai do R2 (o download do cliente continua pelo Drive)
    print(f"pronto em {time.time() - inicio:.0f}s: {previa}")


if __name__ == "__main__":
    try:
        try:
            main()
        finally:
            apaga_copia()
    except Exception as e:
        avisa("previa_erro", erro=str(e)[:300])
        print("erro:", e, file=sys.stderr)
        sys.exit(1)
