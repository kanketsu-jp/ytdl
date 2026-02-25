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
  router.js                     # URL router: detects backend from URL type
  backends/
    index.js                    # Backend registry & export
    base.js                     # Abstract base class for all backends
    ytdlp.js                    # yt-dlp backend (wraps bin/ytdl.sh)
    torrent.js                  # Torrent backend (webtorrent, P2P)
    stream.js                   # Stream backend (RTMP/RTSP via ffmpeg spawn)
    analyzer.js                 # Site analyzer backend (Chrome CDP, config: ~/.ytdl/)
  open-dir.js                   # Post-download directory opener (cross-platform)
skills/
  download/SKILL.md             # Claude Code agent skill (AskUserQuestion flow)
.claude-plugin/
  plugin.json                   # Claude Code plugin manifest
  marketplace.json              # Marketplace catalog
```

## How It Works

**Human (terminal):**
- `ytdl` with no args → interactive UI (@clack/prompts)
- `ytdl <args>` → URL router detects backend, dispatches to appropriate handler

**URL Routing:**
- `http(s)://` → yt-dlp backend (1000+ sites via yt-dlp)
- `magnet:` / `.torrent` → torrent backend (webtorrent)
- `rtmp://` / `rtsp://` → stream backend (ffmpeg)
- `--analyze` flag → site analyzer backend (Chrome CDP)
- yt-dlp failure → optional fallback to site analyzer

**Claude Code (plugin):**
- Skill activates on any media URL or download request (including magnet links, streams)
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
--via <backend>      force download backend (ytdlp/torrent/stream/analyzer)
--analyze            force site analyzer mode
--duration <sec>     stream recording duration (seconds)
--            pass remaining to yt-dlp

URL types:
  http(s)://  → yt-dlp backend (auto-detected, 1000+ sites)
  magnet:     → torrent backend (webtorrent P2P)
  rtmp(s)://  → stream backend (ffmpeg direct capture)
  rtsp://     → stream backend (ffmpeg direct capture)
```

## Output Templates

- Single: `{base}/{channel}/{title}/{title}.{ext}`
- Playlist: `{base}/{channel}/{playlist}/{NNN}_{title}/{NNN}_{title}.{ext}`

## Demo Directory

`demo/` contains a Remotion project for generating promo videos. This directory is gitignored and excluded from the npm package. Do not commit or track files in `demo/`.

## Editing Notes

Adding an option → update: `bin/ytdl.sh` (while/case + show_help + i18n vars), `lib/interactive.js`, `lib/build-args.js`, `lib/i18n.js` (ja/en keys), `skills/download/SKILL.md`

Adding a backend → update: `lib/router.js` (URL detection), `lib/backends/index.js` (export), `lib/check-deps.js` (dependency check), `lib/i18n.js` (new keys for all 7 languages)

**bin/ytdl.sh must NOT be modified** — it handles only the yt-dlp backend path. New backends are implemented entirely in `lib/backends/`.

## Release Checklist (MUST follow on every version bump)

When any feature, option, or architecture change is made, ALL of the following documents MUST be updated before release:

1. **README.md** (English, base) — options table, usage examples, architecture description
2. **README.ja.md** — Japanese translation, keep in sync with README.md
3. **README.zh-Hans.md** — Simplified Chinese translation
4. **README.es.md** — Spanish translation
5. **README.hi.md** — Hindi translation
6. **README.pt.md** — Portuguese translation
7. **README.id.md** — Indonesian translation
8. **article.md** — Technical article (Japanese). Update TL;DR, architecture diagram, options table, feature descriptions
9. **CLAUDE.md** — This file. Update Repository Structure, Command Interface, and any changed sections
10. **skills/download/SKILL.md** — AI skill definition. Update command reference and workflow steps
11. **package.json** — version bump

All 7 README files must have identical structure and content (translated). Do NOT update only some languages — update ALL or NONE.

12. **npm publish** — Run `npm publish --access public` after all docs are updated
13. **GitHub Release** — Create release with `gh release create vX.Y.Z` including release notes
14. **Release Notes** — Write concise changelog in both Japanese and English. Format:

```markdown
## vX.Y.Z

### 新機能 / New Features
- ...

### 変更 / Changes
- ...

### 修正 / Fixes
- ...
```

