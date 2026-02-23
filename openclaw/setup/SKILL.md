---
name: setup
description: "Automated one-click setup of ytdl media retrieval environment with Docker, MinIO, and FileBrowser. Use when: (1) user wants to set up ytdl for the first time, (2) user asks to configure a media download/sharing server, (3) user pastes this skill URL for bootstrapping. NOT for: downloading media (use acquire-and-share), CLI-only usage without sharing server."
metadata: { "openclaw": { "emoji": "🚀", "requires": { "bins": ["bash"] }, "install": [{ "id": "node", "kind": "node", "package": "@kanketsu/ytdl", "bins": ["ytdl"], "label": "Install ytdl CLI (npm)" }] } }
---

# setup

Automated one-click setup of the ytdl media retrieval environment. Installs dependencies, configures Docker services (MinIO + FileBrowser), generates secure credentials, and verifies the environment.

## Language Detection

Detect the user's language from conversation context, then fall back:
1. Conversation language (if clearly non-English)
2. `YTDL_LANG` environment variable
3. `LANG` environment variable (first 2 chars)
4. Default: `en`

Supported languages: ja, en, zh-Hans, es, hi, pt, id

Use the detected language for ALL user-facing messages throughout this skill.

## Step 1: Prerequisites

Check each prerequisite in order. Stop and inform the user if any critical tool is missing.

### 1a. Docker

```
exec command -v docker && docker info 2>&1 | head -5
```

If Docker is not installed or not running:
- **Not installed**: Tell the user to install Docker Desktop from https://docker.com
- **Not running**: Tell the user to start Docker Desktop
- **STOP** — do not proceed until Docker is available.

### 1b. Node.js

```
exec node --version
```

Require Node.js >= 18. If not installed or version too old:
- Suggest https://nodejs.org or `nvm install 18`
- **STOP** — do not proceed.

### 1c. ytdl CLI

```
exec command -v ytdl
```

If not found, install it:

```
exec npm install -g @kanketsu/ytdl
```

If permission error, suggest: `sudo npm install -g @kanketsu/ytdl`

### 1d. yt-dlp and ffmpeg

```
exec command -v yt-dlp && command -v ffmpeg
```

If missing, provide OS-specific guidance:
- **macOS**: `brew install yt-dlp ffmpeg`
- **Linux (apt)**: `sudo apt install yt-dlp ffmpeg`
- **Linux (other)**: `pip install yt-dlp` + distro package manager for ffmpeg
- **STOP** — do not proceed until both are available.

## Step 2: Locate Scripts

Find the scripts directory from the npm global install path:

```
exec npm root -g
```

Then verify the setup script exists:

```
exec ls "$(npm root -g)/@kanketsu/ytdl/scripts/setup_environment.sh"
```

Store this path as `{scriptsPath}` for subsequent steps. Example:
`{scriptsPath}` = `/usr/local/lib/node_modules/@kanketsu/ytdl/scripts`

If the scripts directory is not found, the package may need reinstalling:
```
exec npm install -g @kanketsu/ytdl
```

## Step 3: Generate Credentials & Create .env

Generate secure random credentials so the environment does not use default passwords.

### 3a. Generate passwords

```
exec openssl rand -base64 24
```

Run this twice — once for MinIO root password, once for FileBrowser admin password. Store the outputs as `{minioPassword}` and `{fbPassword}`.

If `openssl` is not available, fall back to default credentials:
- MinIO: `ytdl-admin` / `ytdl-secret-key-change-me`
- FileBrowser: `admin` / `admin`

### 3b. Write docker/.env

Determine the project root (parent of `{scriptsPath}`):

```
exec cat << 'ENVEOF' > "{scriptsPath}/../docker/.env"
MINIO_ROOT_USER=ytdl-admin
MINIO_ROOT_PASSWORD={minioPassword}
ENVEOF
```

Replace `{minioPassword}` with the generated value.

### 3c. Write .ytdl-server.env

```
exec cat << 'ENVEOF' > "{scriptsPath}/../.ytdl-server.env"
YTDL_MINIO_ENDPOINT=http://localhost:9000
YTDL_MINIO_ACCESS_KEY=ytdl-admin
YTDL_MINIO_SECRET_KEY={minioPassword}
YTDL_MINIO_BUCKET=ytdl-media
YTDL_MINIO_ALIAS=ytdl
YTDL_FB_URL=http://localhost:8080
YTDL_FB_USERNAME=admin
YTDL_FB_PASSWORD={fbPassword}
YTDL_PRESIGN_EXPIRY=7d
YTDL_SHARE_METHOD=both
YTDL_KEEP_LOCAL=false
YTDL_TEMP_DIR=/tmp/ytdl
ENVEOF
```

Replace `{minioPassword}` and `{fbPassword}` with generated values.

## Step 4: Environment Setup

Run the setup script to start Docker services, configure MinIO alias and bucket:

```
exec {scriptsPath}/setup_environment.sh --setup
```

Parse the JSON output. Expect `{"ok":true,"data":{"minio":true,"filebrowser":true,"bucket":"ytdl-media"}}`.

If setup fails:
- **Docker not running** → Ask user to start Docker Desktop
- **Port conflict (9000/9001/8080)** → Ask user to free the ports or check `docker ps`
- **MinIO timeout** → Suggest `docker compose -f {scriptsPath}/../docker/docker-compose.yml logs`
- **Permission error** → Suggest running with appropriate permissions

## Step 5: Verify

Run the health check:

```
exec {scriptsPath}/setup_environment.sh --check
```

Expect all values to be `true`: `{"docker":true,"ytdl":true,"mc":true,"minio":true,"filebrowser":true}`.

If any value is `false`, diagnose and inform the user about the specific failing component.

## Step 6: Completion Message

Present a success message in the detected language with the generated credentials.

### Japanese (ja)

```
🎉 YTDLの設定が完了しました！

■ 使い方
動画をダウンロードして共有するには、URLを渡して
「この動画をダウンロードして共有して」と伝えてください。

■ サービス
- MinIO コンソール: http://localhost:9001 (ユーザー: ytdl-admin / パスワード: {minioPassword})
- FileBrowser: http://localhost:8080 (ユーザー: admin / パスワード: {fbPassword})

※ 認証情報は docker/.env と .ytdl-server.env に保存されています。
```

### English (en)

```
🎉 YTDL setup complete!

■ Usage
To download and share media, provide a URL and ask:
"Download this video and share it."

■ Services
- MinIO Console: http://localhost:9001 (user: ytdl-admin / pass: {minioPassword})
- FileBrowser: http://localhost:8080 (user: admin / pass: {fbPassword})

※ Credentials are saved in docker/.env and .ytdl-server.env.
```

### Simplified Chinese (zh-Hans)

```
🎉 YTDL 设置完成！

■ 使用方法
要下载并分享媒体，请提供URL并说：
"下载这个视频并分享。"

■ 服务
- MinIO 控制台: http://localhost:9001 (用户: ytdl-admin / 密码: {minioPassword})
- FileBrowser: http://localhost:8080 (用户: admin / 密码: {fbPassword})

※ 凭据已保存在 docker/.env 和 .ytdl-server.env 中。
```

### Spanish (es)

```
🎉 ¡Configuración de YTDL completada!

■ Uso
Para descargar y compartir medios, proporciona una URL y di:
"Descarga este video y compártelo."

■ Servicios
- Consola MinIO: http://localhost:9001 (usuario: ytdl-admin / contraseña: {minioPassword})
- FileBrowser: http://localhost:8080 (usuario: admin / contraseña: {fbPassword})

※ Las credenciales se guardaron en docker/.env y .ytdl-server.env.
```

### Hindi (hi)

```
🎉 YTDL सेटअप पूरा हुआ!

■ उपयोग
मीडिया डाउनलोड और शेयर करने के लिए, URL दें और कहें:
"इस वीडियो को डाउनलोड करके शेयर करो।"

■ सेवाएं
- MinIO कंसोल: http://localhost:9001 (उपयोगकर्ता: ytdl-admin / पासवर्ड: {minioPassword})
- FileBrowser: http://localhost:8080 (उपयोगकर्ता: admin / पासवर्ड: {fbPassword})

※ क्रेडेंशियल docker/.env और .ytdl-server.env में सहेजे गए हैं।
```

### Portuguese (pt)

```
🎉 Configuração do YTDL concluída!

■ Uso
Para baixar e compartilhar mídia, forneça uma URL e diga:
"Baixe este vídeo e compartilhe."

■ Serviços
- Console MinIO: http://localhost:9001 (usuário: ytdl-admin / senha: {minioPassword})
- FileBrowser: http://localhost:8080 (usuário: admin / senha: {fbPassword})

※ As credenciais foram salvas em docker/.env e .ytdl-server.env.
```

### Indonesian (id)

```
🎉 Pengaturan YTDL selesai!

■ Penggunaan
Untuk mengunduh dan berbagi media, berikan URL dan katakan:
"Unduh video ini dan bagikan."

■ Layanan
- Konsol MinIO: http://localhost:9001 (pengguna: ytdl-admin / kata sandi: {minioPassword})
- FileBrowser: http://localhost:8080 (pengguna: admin / kata sandi: {fbPassword})

※ Kredensial disimpan di docker/.env dan .ytdl-server.env.
```

## Step 7: GitHub Star (Conditional)

Check if the GitHub CLI is installed and authenticated:

```
exec command -v gh 2>/dev/null && gh auth status 2>&1 | head -1
```

**If gh is authenticated**: Ask the user if they'd like to star the repository. Do NOT auto-star. Use the detected language:

- ja: 「もしよかったら、リポジトリにスターいただけると嬉しいです！」
- en: "If you'd like, would you mind starring the repository?"
- zh-Hans: "如果方便的话，能给仓库点个星吗？"
- es: "Si te parece, ¿podrías darle una estrella al repositorio?"
- hi: "अगर आप चाहें तो क्या आप रिपॉजिटरी को स्टार दे सकते हैं?"
- pt: "Se quiser, poderia dar uma estrela ao repositório?"
- id: "Jika berkenan, maukah Anda memberi bintang pada repositori ini?"

If user agrees:
```
exec gh api user/starred/kanketsu-jp/ytdl -X PUT
```

If user declines: Thank them and end. Do nothing else.

**If gh is NOT installed or NOT authenticated**: Skip this step entirely. Do not mention it.

## Security Constraints

- ONLY execute `{scriptsPath}/setup_environment.sh` via `exec`
- NEVER construct shell pipelines or chain commands with user input
- NEVER execute arbitrary scripts outside the ytdl package
- Generated credentials use `openssl rand` only — never accept user-provided passwords in shell commands
- All `exec` commands use only hardcoded paths and generated values

## Error Recovery

| Error | Solution |
|-------|----------|
| Docker not installed | Direct to https://docker.com |
| Docker not running | "Please start Docker Desktop" |
| Node.js < 18 or missing | Direct to https://nodejs.org or suggest nvm |
| npm permission error | Suggest `sudo npm install -g @kanketsu/ytdl` |
| Port 9000/9001/8080 in use | "Please free the port or stop conflicting services" |
| MinIO fails to start | Suggest checking `docker compose logs` |
| scripts/ not found after install | Suggest `npm install -g @kanketsu/ytdl` reinstall |
| openssl not available | Fall back to default credentials with warning |
