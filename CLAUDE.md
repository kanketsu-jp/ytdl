# ytdl

Developer-oriented media retrieval CLI (`@kanketsu/ytdl`) + Claude Code plugin. Wraps yt-dlp with interactive UI.

## Repository Structure

```
cli.js                          # npm bin entry point
bin/ytdl.sh                     # Core bash script (yt-dlp invocation)
lib/
  check-deps.js                 # yt-dlp/ffmpeg existence check + auto-install
  interactive.js                # @clack/prompts interactive UI
  build-args.js                 # Interactive choices → CLI flags
  i18n.js                       # i18n (ja/en/zh-Hans/es/hi/pt/id), language detection
  transcribe.js                 # Transcription core (local mlx-whisper / OpenAI API)
  spec-check.js                 # Machine spec check (Apple Silicon / memory, cached)
skills/
  download/SKILL.md             # Claude Code agent skill (AskUserQuestion flow)
.claude-plugin/
  plugin.json                   # Claude Code plugin manifest
  marketplace.json              # Marketplace catalog
```

## How It Works

**Human (terminal):**
- `ytdl` with no args → interactive UI (@clack/prompts)
- `ytdl <args>` → direct passthrough to bin/ytdl.sh

**Claude Code (plugin):**
- Skill activates on YouTube URLs or download requests
- Uses AskUserQuestion for mode/quality/location choices
- Runs `ytdl` commands via Bash tool

## Plugin Install

```
/plugin marketplace add kanketsu-jp/ytdl
/plugin install ytdl@kanketsu-ytdl
```

## Command Interface

```
ytdl [options] <URL> [-- yt-dlp-options...]

-a            audio only (m4a)
-q <res>      quality cap (360/480/720/1080/1440/2160)
-o <dir>      output dir (default: ~/Downloads)
-p            playlist mode
-b <browser>  cookie browser (default: off)
-n            no cookies (default)
-i            info only
-t            transcribe after download (local mlx-whisper or OpenAI API)
--backend <b> transcribe backend (local/api, default: local)
--manuscript <path>  manuscript file for accuracy boost
--lang <code> language (ja/en/zh-Hans/es/hi/pt/id, default: ja, or set YTDL_LANG env)
--            pass remaining to yt-dlp
```

## Output Templates

- Single: `{base}/{channel}/{title}/{title}.{ext}`
- Playlist: `{base}/{channel}/{playlist}/{NNN}_{title}/{NNN}_{title}.{ext}`

## Demo Directory

`demo/` contains a Remotion project for generating promo videos. This directory is gitignored and excluded from the npm package. Do not commit or track files in `demo/`.

## Editing Notes

Adding an option → update: `bin/ytdl.sh` (while/case + show_help + i18n vars), `lib/interactive.js`, `lib/build-args.js`, `lib/i18n.js` (ja/en keys), `skills/download/SKILL.md`

