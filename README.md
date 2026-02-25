# ytdl

> 🇺🇸 **English** | 🇯🇵 [日本語](./README.ja.md) | 🇨🇳 [简体中文](./README.zh-Hans.md) | 🇪🇸 [Español](./README.es.md) | 🇮🇳 [हिन्दी](./README.hi.md) | 🇧🇷 [Português](./README.pt.md) | 🇮🇩 [Bahasa Indonesia](./README.id.md)

A developer-oriented universal media retrieval CLI. Downloads from video sites via [yt-dlp](https://github.com/yt-dlp/yt-dlp), torrents (P2P), RTMP/RTSP streams, and more. Interactive UI + AI-native (Claude Code plugin).

## Compliance & Legal Notice

This project is a general-purpose media retrieval tool.

It is intended to be used only for content that:
- you own the rights to
- is publicly licensed (e.g. Creative Commons)
- is explicitly permitted to download by the platform

Users are responsible for complying with copyright laws and the terms of service of each platform. This project does **not** encourage or support downloading copyrighted content without permission.

## Prohibited Use

- Downloading copyrighted content without permission
- Downloading paid or subscription-only content without authorization
- Redistributing downloaded media
- Circumventing DRM or technical protection measures

## Allowed Use Cases

- Downloading your own uploaded content for backup
- Offline processing of media you have rights to
- Archiving Creative Commons / public domain content
- Educational and research purposes with proper rights

## Install

```bash
npm install -g @kanketsu/ytdl
```

Requires [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org/). On first run, ytdl will offer to install them automatically if missing. To install manually:

```bash
brew install yt-dlp ffmpeg
```

### Language

Default UI language is Japanese. To switch to English:

```bash
# Environment variable
YTDL_LANG=en ytdl

# CLI flag
ytdl --lang en "URL"
```

## Usage

### Interactive mode

Run with no arguments — select everything step by step:

```bash
ytdl
```

### Command mode

```bash
# Video sites (yt-dlp, 1000+ sites)
ytdl "https://example.com/watch?v=VIDEO_ID"        # best quality + thumbnail + subs + description
ytdl -a "https://example.com/watch?v=VIDEO_ID"     # audio only (m4a)
ytdl -q 720 "https://example.com/watch?v=VIDEO_ID" # 720p cap
ytdl -p "https://example.com/playlist?list=..."     # playlist
ytdl -i "https://example.com/watch?v=VIDEO_ID"     # info only (no download)

# Torrent / P2P
ytdl "magnet:?xt=urn:btih:..."                            # magnet link (auto-detected)
ytdl "https://example.com/file.torrent"                   # .torrent URL (auto-detected)

# RTMP / RTSP streams
ytdl "rtmp://live.example.com/stream/key"                 # RTMP live stream
ytdl "rtsp://camera.example.com/feed"                     # RTSP camera feed
ytdl --duration 60 "rtmp://..."                           # record 60 seconds

# Site analyzer (when yt-dlp can't find the media)
ytdl --analyze "https://example.com/page-with-video"      # force site analysis

# Force a specific backend
ytdl --via torrent "magnet:?xt=..."
ytdl --via stream "rtmp://..."
ytdl --via ytdlp "https://..."

# Pass yt-dlp options directly
ytdl "URL" -- --limit-rate 1M
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-a` | Audio only (m4a) | off |
| `-q <res>` | Quality (360/480/720/1080/1440/2160) | best |
| `-o <dir>` | Output directory | `~/Downloads` |
| `-p` | Playlist mode | off |
| `-b <browser>` | Cookie browser | off |
| `-n` | No cookies (default) | on |
| `-i` | Info only | off |
| `-t` | Transcribe after download | off |
| `--backend <b>` | Transcribe backend (local/api) | local |
| `--manuscript <path>` | Manuscript file for accuracy boost | - |
| `--lang <code>` | Language (`ja`/`en`/`zh-Hans`/`es`/`hi`/`pt`/`id`) | `ja` |
| `--via <backend>` | Force backend (ytdlp/torrent/stream/analyzer) | auto |
| `--analyze` | Force site analyzer mode | off |
| `--duration <sec>` | Stream recording duration (seconds) | until stopped |
| `--` | Pass remaining args to yt-dlp | - |

By default, ytdl runs without browser cookies. Use `-b <browser>` for restricted content (age-restricted, member-only, etc.).

## Architecture

ytdl automatically detects the right backend based on the URL:

```
ytdl CLI
  │
  ├── magnet: / .torrent  → Torrent backend (webtorrent P2P)
  ├── rtmp:// / rtsp://   → Stream backend (ffmpeg spawn)
  ├── --analyze flag      → Site analyzer backend (Chrome CDP)
  └── http(s)://          → yt-dlp backend (1000+ sites)
                               └── on failure → Site analyzer fallback
```

The yt-dlp backend wraps `bin/ytdl.sh` (unchanged from v1). New backends live entirely in `lib/backends/`.

## Output

```
~/Downloads/
  └── Channel/
      └── Title/
          ├── Title.mp4
          ├── Title.jpg           # thumbnail
          ├── Title.ja.srt        # subtitles
          ├── Title.description.txt
          └── ytdl_20250226_1234.log
```

---

## Claude Code Plugin

Use ytdl as a Claude Code skill. Claude will interactively ask what to retrieve using AskUserQuestion. Supports video sites, magnet links, RTMP/RTSP streams, and site analysis.

### Install

```
/plugin marketplace add kanketsu-jp/ytdl
/plugin install ytdl@kanketsu-ytdl
```

### Usage

Paste any media URL (video site, magnet link, stream URL) or say "download this" in any Claude Code conversation. The skill activates automatically and:

1. Checks if `ytdl` is installed (prompts to install if missing)
2. Detects URL type and selects the appropriate backend
3. Fetches media info (when applicable)
4. Asks what you want (video/audio, quality, save location)
5. Retrieves the media

## AI Features

### Universal URL Detection

Just paste any URL — ytdl automatically routes to the right backend:
- Video sites (1000+ supported) → yt-dlp
- `magnet:` links → torrent (webtorrent)
- `rtmp://`, `rtsp://` → stream capture (ffmpeg)
- Page with embedded video → site analyzer

### Page URL Analysis

You don't need to find the direct video URL yourself. Just paste the page URL where the video is embedded, and the AI will:

1. Analyze the page to find embedded videos
2. Show you what was found (if multiple, lets you choose)
3. Download the selected video(s)

Works with Claude Code.

**Example:**
```
Save the video from https://example.com/blog/my-post
```

### Batch Downloads

Paste multiple URLs at once. The AI asks your preferences (video/audio, quality) only once and applies them to all downloads.

**Example:**
```
Download these:
https://example.com/watch?v=aaa
https://example.com/watch?v=bbb
magnet:?xt=urn:btih:ccc
```

## Disclaimer

This software is provided for lawful use only. The authors are not responsible for any misuse.

## License

MIT
