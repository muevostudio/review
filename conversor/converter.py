"""
Muevo Review · conversor de prévias

Roda como um Cloud Run Job. Cada execução converte UM vídeo (ou um PDF em imagens de página, com TIPO=pdf,
ou um áudio em versão leve MP3 + desenho das ondas, com TIPO=audio):
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

Onde o ORIGINAL fica enquanto converte (recomendado: Cloud Storage do Google, na mesma região do conversor,
porque assim o arquivo grande não sai do Google e não paga a saída de dados):
  ORIG_BALDE    nome do bucket do Cloud Storage (ex.: muevo-review-originais)
  ORIG_CHAVE    Access ID da chave HMAC do Cloud Storage
  ORIG_SEGREDO  Secret da chave HMAC
Sem essas variáveis (ou se o Cloud Storage recusar), o original fica no R2, como antes.
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


# o original fica guardado só enquanto converte (e para novas tentativas); depois de pronto, é apagado.
# Lugar preferido: Cloud Storage do Google (mesma região, sem custo de saída). Reserva: o R2.
CHAVE_ORIG = f"originais/{JOB}"
ORIG = {k: env("ORIG_" + k, False) for k in ("BALDE", "CHAVE", "SEGREDO")}
LUGAR = {"onde": "gcs" if all(ORIG.values()) else "r2"}


def gcs():
    if "g" not in _S3:
        import boto3
        from botocore.config import Config
        _S3["g"] = boto3.client("s3", endpoint_url=os.environ.get("ORIG_ENDPOINT") or "https://storage.googleapis.com",
                                aws_access_key_id=ORIG["CHAVE"], aws_secret_access_key=ORIG["SEGREDO"], region_name="auto",
                                config=Config(retries={"max_attempts": 6, "mode": "standard"}, signature_version="s3v4"))
    return _S3["g"]


def cli_orig():
    return (gcs(), ORIG["BALDE"]) if LUGAR["onde"] == "gcs" else (s3(), R2["BALDE"])


def original_no_r2():
    """já existe uma cópia do original (de uma tentativa anterior)? Procura no Cloud Storage e no R2."""
    lugares = (["gcs"] if all(ORIG.values()) else []) + ["r2"]
    for onde in lugares:
        try:
            cli, balde = (gcs(), ORIG["BALDE"]) if onde == "gcs" else (s3(), R2["BALDE"])
            if int(cli.head_object(Bucket=balde, Key=CHAVE_ORIG).get("ContentLength") or 0) > 0:
                LUGAR["onde"] = onde
                return True
        except Exception:
            pass
    return False


def traz_para_r2():
    """1º passo: copia o original do Drive para o R2, no tamanho original, sem converter nada.
    É o único momento em que o Drive é acessado. Se já estiver no R2 (nova tentativa), não baixa de novo."""
    if original_no_r2():
        print(f"original já está guardado ({LUGAR['onde']}); não precisa baixar do Drive", file=sys.stderr)
        return
    from boto3.s3.transfer import TransferConfig
    from botocore.exceptions import ClientError, NoCredentialsError, EndpointConnectionError
    esperas = [30, 90]
    i = 0
    while True:
        fase = "drive"
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

            fase = "guardar"
            cli, balde = cli_orig()
            cli.upload_fileobj(resp, balde, CHAVE_ORIG, Callback=andou,
                               Config=TransferConfig(multipart_chunksize=64 * 1024 * 1024, max_concurrency=4))
            print(f"original copiado ({LUGAR['onde']}): {enviado['n'] / 1e6:.0f} MB", file=sys.stderr)
            return
        except Exception as e:
            motivo = str(e)
            print(f"cópia do original falhou ({LUGAR['onde']}, fase {fase}, tentativa {i + 1}): {motivo[:300]}", file=sys.stderr)
            # o Cloud Storage recusou (chave, permissão ou bucket errados): esta conversão usa o R2, sem gastar tentativa
            if LUGAR["onde"] == "gcs" and fase == "guardar" and isinstance(e, (ClientError, NoCredentialsError, EndpointConnectionError)):
                print("Cloud Storage recusou; o original vai para o R2 nesta conversão", file=sys.stderr)
                LUGAR["onde"] = "r2"
                continue
            if i >= len(esperas) or re.search(r"insufficient|notFound|appNotAuthorized|authError", motivo):
                raise RuntimeError("não consegui copiar o original do Drive: " + motivo[:250])
            time.sleep(esperas[i])
            i += 1


def url_original_r2():
    cli, balde = cli_orig()
    return cli.generate_presigned_url("get_object", Params={"Bucket": balde, "Key": CHAVE_ORIG}, ExpiresIn=6 * 3600)


def apaga_original_r2():
    try:
        cli, balde = cli_orig()
        cli.delete_object(Bucket=balde, Key=CHAVE_ORIG)
        print(f"original apagado ({LUGAR['onde']})", file=sys.stderr)
    except Exception as e:
        print("original não apagado:", e, file=sys.stderr)


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


QUADROS = 20   # quadros na folha de prévia (o "spoiler" ao passar o mouse na página da pasta)


def folha_quadros(origem_video, destino, duracao):
    """Uma imagem só com QUADROS quadros do vídeo lado a lado, 240 px de largura cada.
    A página da pasta mostra o quadro do ponto onde o mouse está, sem baixar o vídeo."""
    if not duracao or duracao <= 0:
        return False
    taxa = QUADROS / max(duracao, 0.5)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", origem_video,
                    "-vf", f"fps={taxa:.6f},scale=240:-2,tile={QUADROS}x1:padding=0", "-frames:v", "1", "-q:v", "6", destino],
                   capture_output=True, timeout=300)
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


def avisa_final(acao, **extra):
    """Aviso de fim (pronto ou erro): esse não pode se perder.
    1) guarda o resultado no R2 (resultados/<token>.json), para a planilha conseguir buscar se o aviso falhar;
    2) manda para a planilha e CONFERE a resposta ("ok": true), tentando de novo por alguns minutos."""
    corpo = dict(acao=acao, token=JOB, segredo=SEGREDO, **extra)
    if USA_R2:
        try:
            s3().put_object(Bucket=R2["BALDE"], Key=f"resultados/{JOB}.json", ContentType="application/json",
                            Body=json.dumps({k: v for k, v in corpo.items() if k != "segredo"}).encode())
        except Exception as e:
            print("resultado não guardado no R2:", e, file=sys.stderr)
    for tentativa, espera in enumerate([0, 5, 10, 20, 30, 60, 90, 120]):
        time.sleep(espera)
        try:
            r = urllib.request.Request(CALLBACK, data=json.dumps(corpo).encode(), method="POST",
                                       headers={"Content-Type": "text/plain;charset=utf-8"})
            texto = urllib.request.urlopen(r, timeout=90).read().decode("utf-8", "replace")
            if '"ok":true' in texto.replace(" ", ""):
                return True
            if "job_invalido" in texto or "segredo" in texto:
                print("planilha recusou o aviso de vez:", texto[:200], file=sys.stderr)
                return False
            print(f"planilha não confirmou o aviso (tentativa {tentativa + 1}): {texto[:200]}", file=sys.stderr)
        except Exception as e:
            print(f"aviso para a planilha falhou (tentativa {tentativa + 1}): {e}", file=sys.stderr)
    return False


def avisa_depois(acao, **extra):
    # progresso vai em paralelo, para nunca segurar a conversão
    threading.Thread(target=avisa, args=(acao,), kwargs=extra, daemon=True).start()


def duracao_de(caminho_ou_url, cab=None):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height,codec_type,r_frame_rate,codec_name,duration,nb_frames",
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
           "-threads", "0",   # usa todos os processadores para ler o original (ajuda muito em DXV/ProRes)
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
        if m and time.time() - ultimo > 15:
            ultimo = time.time()
            if total > 0:
                feito = min(1.0, int(m.group(1)) / 1e6 / total)
                avisa_depois("previa_progresso", pct=min(99, int(pct0 + feito * (99 - pct0))))
            else:
                avisa_depois("previa_progresso", pct=max(1, pct0))   # sem duração: ao menos avisa que segue vivo
            print(f"convertendo: {int(m.group(1)) / 1e6:.0f} s de {total:.0f} s", file=sys.stderr)
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
        cli, balde = cli_orig()
        cli.download_file(balde, CHAVE_ORIG, "/tmp/original.pdf")
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
    avisa_final("previa_pronta", previa=ids[0], paginas=ids, segundos=round(time.time() - inicio))
    if USA_R2:
        apaga_original_r2()
    print(f"pdf pronto em {time.time() - inicio:.0f}s: {len(ids)} páginas")


BARRAS = 1000   # barras no desenho das ondas (1 byte cada, mandado para o servidor)


def ondas(caminho, duracao):
    """Desenho das ondas: lê o áudio em mono, 8 mil amostras por segundo, e guarda o pico de cada trecho (0 a 255).
    Volta em hexadecimal, 2 caracteres por barra. A raiz quadrada deixa os trechos baixos visíveis, como no SoundCloud."""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", caminho, "-ac", "1", "-ar", "8000",
                        "-f", "s16le", "-"], capture_output=True, timeout=900)
    dados = p.stdout
    n = len(dados) // 2
    if n < BARRAS:
        return ""
    import array, math
    a = array.array("h"); a.frombytes(dados[:n * 2])
    passo = n / BARRAS
    picos = []
    for i in range(BARRAS):
        trecho = a[int(i * passo):max(int((i + 1) * passo), int(i * passo) + 1)]
        picos.append(max(abs(min(trecho)), max(trecho)) / 32768)
    topo = max(picos) or 1
    return "".join(f"{min(255, int(math.sqrt(x / topo) * 255)):02x}" for x in picos)


def desenho_ondas(picos, destino):
    """Capa do áudio (painel e pasta compartilhada): as ondas em barras com degradê laranja, como no SoundCloud antigo.
    É um SVG feito aqui mesmo, a partir dos picos: fica leve e nítido em qualquer tamanho."""
    if not picos:
        return False
    v = [int(picos[i:i + 2], 16) / 255 for i in range(0, len(picos), 2)]
    n = 140   # barras na capa
    barras = [max(v[int(i * len(v) / n):int((i + 1) * len(v) / n)] or [0]) for i in range(n)]
    L, A, meio = 1200, 360, 250   # a onda de cima ocupa até 250 px; o reflexo embaixo, mais curto e mais claro
    passo = L / n
    partes = []
    for i, b in enumerate(barras):
        h = max(2.0, b * (meio - 20))
        x = i * passo
        partes.append(f'<rect x="{x:.1f}" y="{meio - h:.1f}" width="{passo * 0.62:.1f}" height="{h:.1f}"/>')
        partes.append(f'<rect class="r" x="{x:.1f}" y="{meio + 3}" width="{passo * 0.62:.1f}" height="{h * 0.42:.1f}"/>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {L} {A}" preserveAspectRatio="none">'
           '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF8A3D"/>'
           '<stop offset="1" stop-color="#FF4405"/></linearGradient></defs>'
           '<style>rect{fill:url(#g)}.r{opacity:.35}</style>' + "".join(partes) + '</svg>')
    with open(destino, "w") as f:
        f.write(svg)
    return True


def audio():
    """Áudio (MP3, WAV, AIFF, FLAC…): versão leve em MP3 192 kbps (toca em qualquer navegador), desenho das ondas e capa.
    O original segue no Drive, e é ele que o cliente baixa."""
    inicio = time.time()
    avisa("previa_progresso", pct=1)
    if USA_R2:
        traz_para_r2()
        origem, cab = url_original_r2(), ""
    else:
        origem = origem_drive()
        cab = "Authorization: Bearer " + TOKEN + "\r\n" + ("X-Goog-User-Project: " + QUOTA + "\r\n" if QUOTA else "")
    info = duracao_de(origem, cab)
    if not any(st.get("codec_type") == "audio" for st in info.get("streams", [])):
        raise RuntimeError("nao_e_audio (o arquivo não parece ser um áudio)")
    total = float((info.get("format") or {}).get("duration") or 0)
    saida = "/tmp/previa.mp3"
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"] + (["-headers", cab] if cab else []) + [
           "-i", origem, "-map", "0:a:0", "-vn", "-c:a", "libmp3lame", "-b:a", "192k", "-ac", "2", "-ar", "44100",
           "-progress", "pipe:1", "-nostats", saida]
    pr = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    ultimo = 0.0
    for linha in pr.stdout:
        m = re.match(r"out_time_us=(\d+)", linha.strip())
        if m and total > 0 and time.time() - ultimo > 10:
            ultimo = time.time()
            avisa_depois("previa_progresso", pct=min(90, int(20 + int(m.group(1)) / 1e6 / total * 70)))
    pr.wait()
    if pr.returncode != 0:
        raise RuntimeError("ffmpeg: " + pr.stderr.read()[-500:])
    avisa_depois("previa_progresso", pct=92)
    picos = ondas(saida, total)
    dur = float((duracao_de(saida).get("format") or {}).get("duration") or total or 0)
    if USA_R2:
        previa = envia_r2(saida, BASE_R2 + ".mp3", "audio/mpeg")
        if desenho_ondas(picos, "/tmp/ondas.svg"):
            try:
                envia_r2("/tmp/ondas.svg", BASE_R2 + "-ondas.svg", "image/svg+xml")
            except Exception as e:
                print("desenho das ondas não enviado:", e, file=sys.stderr)
    else:
        previa = envia(saida, re.sub(r"\.(mp4|m4a)$", ".mp3", NOME), "audio/mpeg")
    avisa_final("previa_pronta", previa=previa, duracao=round(dur, 2), ondas=picos, segundos=round(time.time() - inicio))
    if USA_R2:
        apaga_original_r2()
    print(f"áudio pronto em {time.time() - inicio:.0f}s: {previa}")


def main():
    if os.environ.get("TIPO", "video").strip() == "pdf":
        return pdf()
    if os.environ.get("TIPO", "video").strip() == "audio":
        return audio()
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
    if not total:   # alguns formatos (ex.: DXV, do Resolume) não informam a duração no arquivo: usa a do vídeo
        for st in info.get("streams", []):
            try:
                total = max(total, float(st.get("duration") or 0))
            except ValueError:
                pass
    codec = next((st.get("codec_name", "") for st in info.get("streams", []) if st.get("codec_type") == "video"), "")
    print(f"vídeo: {codec}, {total:.0f} s", file=sys.stderr)
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
        try:
            dur_previa = float((duracao_de(SAIDA).get("format") or {}).get("duration") or total or 0)
            if folha_quadros(SAIDA, "/tmp/quadros.jpg", dur_previa):
                envia_r2("/tmp/quadros.jpg", BASE_R2 + "-quadros.jpg", "image/jpeg")
        except Exception as e:   # sem a folha, a página da pasta usa a própria versão leve
            print("folha de quadros não enviada:", e, file=sys.stderr)
    else:
        previa = envia(SAIDA)
    original = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
    avisa_final("previa_pronta", previa=previa,
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
    except BaseException as e:   # qualquer falha, até as mais "graves", avisa a planilha
        avisa_final("previa_erro", erro=(str(e) or e.__class__.__name__)[:300])
        print("erro:", e, file=sys.stderr)
        sys.exit(1)
