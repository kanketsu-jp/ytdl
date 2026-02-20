# ytdl

A developer-oriented media retrieval CLI built on [yt-dlp](https://github.com/yt-dlp/yt-dlp). Interactive UI + AI-native (Claude Code plugin).

> [日本語はこちら](./README.ja.md)

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
ytdl "https://www.youtube.com/watch?v=BaW_jenozKc"                 # best quality + thumbnail + subs + description
ytdl -a "https://www.youtube.com/watch?v=BaW_jenozKc"              # audio only (m4a)
ytdl -q 720 "https://www.youtube.com/watch?v=BaW_jenozKc"          # 720p
ytdl -p "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf" # playlist
ytdl -i "https://www.youtube.com/watch?v=BaW_jenozKc"              # info only (no download)
ytdl -a -o ~/Music "https://www.youtube.com/watch?v=BaW_jenozKc"   # audio to ~/Music
ytdl "URL" -- --limit-rate 1M                                       # pass yt-dlp options
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-a` | Audio only (m4a) | off |
| `-q <res>` | Quality (360/480/720/1080/1440/2160) | best |
| `-o <dir>` | Output directory | `~/Downloads` |
| `-p` | Playlist mode | off |
| `-b <browser>` | Cookie browser | `chrome` |
| `-n` | No cookies | off |
| `-i` | Info only | off |
| `--lang <code>` | Language (`ja` / `en`) | `ja` |
| `--` | Pass to yt-dlp | - |

## Output

```
~/Downloads/
  └── Channel/
      └── Title/
          ├── Title.mp4
          ├── Title.jpg           # thumbnail
          ├── Title.ja.srt        # subtitles
          └── Title.description
```

---

## Claude Code Plugin

Use ytdl as a Claude Code skill. Claude will interactively ask what to retrieve using AskUserQuestion.

### Install

```
/plugin marketplace add kanketsu-jp/ytdl
/plugin install ytdl@kanketsu-jp-ytdl
```

### Usage

Paste a media URL or say "download this" in any Claude Code conversation. The skill activates automatically and:

1. Checks if `ytdl` is installed (prompts to install if missing)
2. Fetches media info
3. Asks what you want (video/audio, quality, save location)
4. Retrieves the media

## Disclaimer

This software is provided for lawful use only. The authors are not responsible for any misuse.

## License

MIT
