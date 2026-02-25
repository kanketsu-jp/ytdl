# ytdl

> 🇺🇸 [English](./README.md) | 🇯🇵 [日本語](./README.ja.md) | 🇨🇳 [简体中文](./README.zh-Hans.md) | 🇪🇸 [Español](./README.es.md) | 🇮🇳 [हिन्दी](./README.hi.md) | 🇧🇷 **Português** | 🇮🇩 [Bahasa Indonesia](./README.id.md)

CLI universal de download de mídia voltada para desenvolvedores. Baixa de sites de vídeo via [yt-dlp](https://github.com/yt-dlp/yt-dlp), torrents (P2P), streams RTMP/RTSP e mais. UI interativa + AI nativo (plugin Claude Code).

## Conformidade e aviso legal

Este projeto é uma ferramenta geral de download de mídia.

Destina-se ao uso apenas com conteúdo que:
- você possui os direitos
- possui licença pública (ex: Creative Commons)
- a plataforma permite explicitamente o download

Os usuários são responsáveis por cumprir as leis de direitos autorais e os termos de serviço de cada plataforma. Este projeto **não** incentiva ou apoia o download de conteúdo protegido sem permissão.

## Uso proibido

- Download de conteúdo protegido sem permissão
- Download de conteúdo pago ou por assinatura sem autorização
- Redistribuição de mídia baixada
- Contornar DRM ou medidas de proteção técnica

## Casos de uso permitidos

- Backup do conteúdo que você enviou
- Processamento offline de mídia sobre a qual você tem direitos
- Arquivamento de conteúdo Creative Commons / domínio público
- Fins educacionais e de pesquisa com direitos adequados

## Instalação

```bash
npm install -g @kanketsu/ytdl
```

Requer [yt-dlp](https://github.com/yt-dlp/yt-dlp) e [ffmpeg](https://ffmpeg.org/). Na primeira execução, se não estiverem instalados, o ytdl oferecerá instalação automática. Para instalar manualmente:

```bash
brew install yt-dlp ffmpeg
```

### Idioma

O idioma padrão da UI é japonês. Para mudar para português:

```bash
# Variável de ambiente
YTDL_LANG=pt ytdl

# Flag CLI
ytdl --lang pt "URL"
```

## Uso

### Modo interativo

Execute sem argumentos — selecione passo a passo:

```bash
ytdl
```

### Modo comando

```bash
# Sites de vídeo (yt-dlp, mais de 1000 sites)
ytdl "https://example.com/watch?v=VIDEO_ID"        # melhor qualidade + miniatura + legendas + descrição
ytdl -a "https://example.com/watch?v=VIDEO_ID"     # somente áudio (m4a)
ytdl -q 720 "https://example.com/watch?v=VIDEO_ID" # 720p
ytdl -p "https://example.com/playlist?list=..."     # playlist
ytdl -i "https://example.com/watch?v=VIDEO_ID"     # apenas informações (sem download)

# Torrent / P2P
ytdl "magnet:?xt=urn:btih:..."                            # link magnet (auto-detectado)
ytdl "https://example.com/file.torrent"                   # URL .torrent (auto-detectado)

# Streams RTMP / RTSP
ytdl "rtmp://live.example.com/stream/key"                 # stream RTMP ao vivo
ytdl "rtsp://camera.example.com/feed"                     # câmera RTSP
ytdl --duration 60 "rtmp://..."                           # gravar 60 segundos

# Analisador de sites (quando yt-dlp não consegue obter a mídia)
ytdl --analyze "https://example.com/page-with-video"      # forçar análise de site

# Forçar um backend específico
ytdl --via torrent "magnet:?xt=..."
ytdl --via stream "rtmp://..."
ytdl --via ytdlp "https://..."

# Passar opções diretamente ao yt-dlp
ytdl "URL" -- --limit-rate 1M
```

## Opções

| Flag | Descrição | Padrão |
|------|-----------|--------|
| `-a` | Somente áudio (m4a) | off |
| `-q <res>` | Qualidade (360/480/720/1080/1440/2160) | melhor |
| `-o <dir>` | Diretório de saída | `~/Downloads` |
| `-p` | Modo playlist | off |
| `-b <navegador>` | Navegador para cookies | off |
| `-n` | Sem cookies (padrão) | on |
| `-i` | Apenas informações | off |
| `-t` | Transcrever após download | off |
| `--backend <b>` | Backend de transcrição (local/api) | local |
| `--manuscript <path>` | Caminho do manuscrito (para precisão) | - |
| `--lang <code>` | Idioma (`ja`/`en`/`zh-Hans`/`es`/`hi`/`pt`/`id`) | `ja` |
| `--via <backend>` | Especificar backend (ytdlp/torrent/stream/analyzer) | auto |
| `--analyze` | Forçar modo analisador de sites | off |
| `--duration <seg>` | Duração de gravação do stream (segundos) | até parar |
| `--` | Passar ao yt-dlp | - |

Por padrão, o ytdl funciona sem cookies do navegador. Use `-b <navegador>` para conteúdo restrito (idade, membros, etc.).

## Arquitetura

ytdl detecta automaticamente o backend correto com base no tipo de URL:

```
ytdl CLI
  │
  ├── magnet: / .torrent  → Backend Torrent (webtorrent P2P)
  ├── rtmp:// / rtsp://   → Backend stream (ffmpeg spawn)
  ├── flag --analyze      → Backend analisador de sites (Chrome CDP)
  └── http(s)://          → Backend yt-dlp (1000+ sites)
                               └── em falha → fallback analisador
```

O backend yt-dlp envolve `bin/ytdl.sh` (sem alterações desde v1). Novos backends estão completamente em `lib/backends/`.

## Saída

```
~/Downloads/
  └── Canal/
      └── Título/
          ├── Título.mp4
          ├── Título.jpg           # miniatura
          ├── Título.pt.srt        # legendas
          ├── Título.description.txt
          └── ytdl_20250226_1234.log
```

---

## Plugin Claude Code

Use o ytdl como habilidade do Claude Code. O Claude perguntará interativamente o que baixar usando AskUserQuestion. Compatível com sites de vídeo, links magnet, streams RTMP/RTSP e análise de sites.

### Instalação

```
/plugin marketplace add kanketsu-jp/ytdl
/plugin install ytdl@kanketsu-ytdl
```

### Uso

Cole qualquer URL de mídia (site de vídeo, link magnet, URL de stream) ou diga "baixe isso" em qualquer conversa do Claude Code. A habilidade é ativada automaticamente e:

1. Verifica se o `ytdl` está instalado (propõe instalação se ausente)
2. Detecta o tipo de URL e seleciona o backend adequado
3. Obtém informações da mídia (quando aplicável)
4. Pergunta o que você deseja (vídeo/áudio, qualidade, local de salvamento)
5. Faz o download

## Recursos IA

### Detecção universal de URL

Basta colar qualquer URL — ytdl roteia automaticamente para o backend correto:
- Sites de vídeo (1000+ suportados) → yt-dlp
- links `magnet:` → Torrent (webtorrent)
- `rtmp://`, `rtsp://` → captura de stream (ffmpeg)
- página com vídeo incorporado → analisador de sites

### Análise de URL de página

Não é necessário encontrar a URL direta do vídeo. Basta colar a URL da página onde o vídeo está incorporado, e a IA irá:

1. Analisar a página para encontrar vídeos incorporados
2. Mostrar o que foi encontrado (se houver vários, permite escolher)
3. Baixar o(s) vídeo(s) selecionado(s)

Funciona com Claude Code.

**Exemplo:**
```
Salve o vídeo de https://example.com/blog/my-post
```

### Downloads em lote

Cole múltiplas URLs de uma vez. A IA pergunta suas preferências (vídeo/áudio, qualidade) apenas uma vez e aplica a todos os downloads.

**Exemplo:**
```
Baixe estes:
https://example.com/watch?v=aaa
https://example.com/watch?v=bbb
magnet:?xt=urn:btih:ccc
```

## Isenção de responsabilidade

Este software é fornecido apenas para uso legal. Os autores não são responsáveis por qualquer uso indevido.

## Licença

MIT
