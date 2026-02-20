#!/bin/bash
# ytdl: media retrieval CLI — yt-dlp wrapper
set -euo pipefail

# --- Color definitions ---
C=$'\033[36m'     # cyan
Y=$'\033[33m'     # yellow
G=$'\033[32m'     # green
R=$'\033[31m'     # red
W=$'\033[1;37m'   # white bold
D=$'\033[2m'      # dim
N=$'\033[0m'      # reset
LINE="${W}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"

# --- Language ---
LANG_CODE="ja"

# Parse --lang first (before other opts)
_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --lang) LANG_CODE="$2"; shift 2 ;;
    *) _ARGS+=("$1"); shift ;;
  esac
done
set -- "${_ARGS[@]+"${_ARGS[@]}"}"

# --- i18n ---
if [[ "$LANG_CODE" == "en" ]]; then
  L_ERROR_YTDLP="Error: yt-dlp not found"
  L_INSTALL_YTDLP="Install with: brew install yt-dlp"
  L_TITLE="ytdl"
  L_SUBTITLE="— media retrieval CLI"
  L_USAGE="Usage:"
  L_OPTIONS="Options:"
  L_OPT_A="Audio only (m4a)"
  L_OPT_Q="Quality (360/480/720/1080/1440/2160)"
  L_OPT_O="Output directory"
  L_OPT_P="Playlist mode (numbered prefix)"
  L_OPT_B="Cookie browser"
  L_OPT_N="No cookies"
  L_OPT_I="Show info only (no download)"
  L_OPT_H="Show this help"
  L_OPT_PASS="Pass remaining args to yt-dlp"
  L_EXAMPLES="Examples:"
  L_EX_BEST="# Best quality, full download"
  L_EX_AUDIO="# Audio only"
  L_EX_Q720="# 720p"
  L_EX_PLAYLIST="# Playlist download"
  L_EX_INFO="# Info only"
  L_EX_MUSIC="# Audio to ~/Music"
  L_ERR_RES="Error: Invalid resolution:"
  L_ERR_RES_VALID="Valid values: 360, 480, 720, 1080, 1440, 2160"
  L_ERR_BROWSER="Error: Unsupported browser:"
  L_ERR_UNKNOWN="Error: Unknown option:"
  L_ERR_HELP="Run ytdl -h for help"
  L_ERR_MULTI_URL="Error: Multiple URLs specified"
  L_ERR_NO_URL="Error: Please specify a URL"
  L_FETCHING="Fetching video info..."
  L_ERR_FETCH="Error: Failed to fetch video info"
  L_PY_TITLE="Title:"
  L_PY_CHANNEL="Channel:"
  L_PY_DURATION="Duration:"
  L_PY_UPLOADED="Uploaded:"
  L_PY_VIEWS="Views:"
  L_PY_LIKES="Likes:"
  L_PY_FORMATS="Available formats:"
  L_STARTING="— Starting download"
  L_URL="URL:"
  L_MODE="Mode:"
  L_MODE_AUDIO="Audio only (m4a)"
  L_QUALITY="Quality:"
  L_QUALITY_BEST="Best"
  L_SAVETO="Save to:"
  L_PLAYLIST="Playlist:"
  L_COOKIE="Cookie:"
  L_COOKIE_NONE="none"
  L_EXTRA="Extra args:"
  L_DONE="Download complete"
else
  L_ERROR_YTDLP="エラー: yt-dlp が見つかりません"
  L_INSTALL_YTDLP="brew install yt-dlp  でインストールしてください"
  L_TITLE="ytdl"
  L_SUBTITLE="— メディア取得 CLI"
  L_USAGE="使い方:"
  L_OPTIONS="オプション:"
  L_OPT_A="音声のみ（m4a）"
  L_OPT_Q="画質指定（360/480/720/1080/1440/2160）"
  L_OPT_O="保存先ディレクトリ"
  L_OPT_P="プレイリストモード（番号プレフィックス付き）"
  L_OPT_B="クッキー取得元ブラウザ"
  L_OPT_N="クッキーなしで実行"
  L_OPT_I="動画情報のみ表示（DLしない）"
  L_OPT_H="このヘルプを表示"
  L_OPT_PASS="以降を yt-dlp に直接渡す"
  L_EXAMPLES="例:"
  L_EX_BEST="# 最高画質で全部入りDL"
  L_EX_AUDIO="# 音声のみ"
  L_EX_Q720="# 720p指定"
  L_EX_PLAYLIST="# プレイリスト一括"
  L_EX_INFO="# 情報のみ表示"
  L_EX_MUSIC="# 音声を~/Musicに保存"
  L_ERR_RES="エラー: 無効な解像度:"
  L_ERR_RES_VALID="有効な値: 360, 480, 720, 1080, 1440, 2160"
  L_ERR_BROWSER="エラー: 未対応のブラウザ:"
  L_ERR_UNKNOWN="エラー: 不明なオプション:"
  L_ERR_HELP="ytdl -h でヘルプを表示"
  L_ERR_MULTI_URL="エラー: URLが複数指定されています"
  L_ERR_NO_URL="エラー: URLを指定してください"
  L_FETCHING="動画情報を取得中..."
  L_ERR_FETCH="エラー: 動画情報の取得に失敗しました"
  L_PY_TITLE="タイトル:"
  L_PY_CHANNEL="チャンネル:"
  L_PY_DURATION="再生時間:"
  L_PY_UPLOADED="公開日:"
  L_PY_VIEWS="視聴回数:"
  L_PY_LIKES="高評価:"
  L_PY_FORMATS="利用可能フォーマット:"
  L_STARTING="— ダウンロード開始"
  L_URL="URL:"
  L_MODE="モード:"
  L_MODE_AUDIO="音声のみ (m4a)"
  L_QUALITY="画質:"
  L_QUALITY_BEST="最高画質"
  L_SAVETO="保存先:"
  L_PLAYLIST="プレイリスト:"
  L_COOKIE="クッキー:"
  L_COOKIE_NONE="なし"
  L_EXTRA="追加引数:"
  L_DONE="ダウンロード完了"
fi

# --- yt-dlp existence check ---
if ! command -v yt-dlp &>/dev/null; then
  echo "${R}${L_ERROR_YTDLP}${N}"
  echo "  ${L_INSTALL_YTDLP}"
  exit 1
fi

# --- Help ---
show_help() {
  echo ""
  echo "${LINE}"
  echo "${C}  ${L_TITLE}${N}  ${D}${L_SUBTITLE}${N}"
  echo "${LINE}"
  echo ""
  echo "${W}${L_USAGE}${N}  ytdl [options] <URL> [-- yt-dlp options...]"
  echo ""
  echo "${W}${L_OPTIONS}${N}"
  echo "  ${G}-a${N}             ${L_OPT_A}"
  echo "  ${G}-q${N} <res>       ${L_OPT_Q}"
  echo "  ${G}-o${N} <dir>       ${L_OPT_O}  ${D}[~/Downloads]${N}"
  echo "  ${G}-p${N}             ${L_OPT_P}"
  echo "  ${G}-b${N} <browser>   ${L_OPT_B}  ${D}[chrome]${N}"
  echo "  ${G}-n${N}             ${L_OPT_N}"
  echo "  ${G}-i${N}             ${L_OPT_I}"
  echo "  ${G}-h${N}             ${L_OPT_H}"
  echo "  ${G}--${N}             ${L_OPT_PASS}"
  echo ""
  echo "${W}${L_EXAMPLES}${N}"
  echo "  ${C}ytdl \"https://youtu.be/xxxxx\"${N}              ${D}${L_EX_BEST}${N}"
  echo "  ${C}ytdl -a \"https://youtu.be/xxxxx\"${N}           ${D}${L_EX_AUDIO}${N}"
  echo "  ${C}ytdl -q 720 \"https://youtu.be/xxxxx\"${N}       ${D}${L_EX_Q720}${N}"
  echo "  ${C}ytdl -p \"https://youtube.com/playlist?...\"${N} ${D}${L_EX_PLAYLIST}${N}"
  echo "  ${C}ytdl -i \"https://youtu.be/xxxxx\"${N}           ${D}${L_EX_INFO}${N}"
  echo "  ${C}ytdl -a -o ~/Music \"https://youtu.be/...\"${N}  ${D}${L_EX_MUSIC}${N}"
  echo ""
}

# --- Defaults ---
AUDIO_ONLY=false
QUALITY=""
BASE_DIR="$HOME/Downloads"
PLAYLIST_MODE=false
BROWSER="chrome"
NO_COOKIE=false
INFO_ONLY=false
URL=""
EXTRA_ARGS=()

# --- Parse options ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    -a) AUDIO_ONLY=true; shift ;;
    -q)
      if [[ -z "${2:-}" || "$2" == -* ]]; then
        echo "${R}${L_ERR_RES} (empty)${N}"; echo "  ${D}${L_ERR_RES_VALID}${N}"; exit 1
      fi
      case "$2" in
        360|480|720|1080|1440|2160) QUALITY="$2" ;;
        *) echo "${R}${L_ERR_RES} $2${N}"; echo "  ${D}${L_ERR_RES_VALID}${N}"; exit 1 ;;
      esac
      shift 2 ;;
    -o)
      if [[ -z "${2:-}" || "$2" == -* ]]; then
        echo "${R}${L_ERR_UNKNOWN} -o (no value)${N}"; exit 1
      fi
      BASE_DIR="$2"; shift 2 ;;
    -p) PLAYLIST_MODE=true; shift ;;
    -b)
      if [[ -z "${2:-}" || "$2" == -* ]]; then
        echo "${R}${L_ERR_BROWSER} (empty)${N}"; exit 1
      fi
      case "$2" in
        chrome|firefox|edge|safari|opera|brave|chromium|vivaldi) BROWSER="$2" ;;
        *) echo "${R}${L_ERR_BROWSER} $2${N}"; exit 1 ;;
      esac
      shift 2 ;;
    -n) NO_COOKIE=true; shift ;;
    -i) INFO_ONLY=true; shift ;;
    -h|--help) show_help; exit 0 ;;
    --)
      shift
      EXTRA_ARGS=("$@")
      break
      ;;
    -*)
      echo "${R}${L_ERR_UNKNOWN} $1${N}"
      echo "  ${D}${L_ERR_HELP}${N}"
      exit 1
      ;;
    *)
      if [[ -z "$URL" ]]; then
        URL="$1"
      else
        echo "${R}${L_ERR_MULTI_URL}${N}"
        exit 1
      fi
      shift
      ;;
  esac
done

# --- URL required ---
if [[ -z "$URL" ]]; then
  echo "${R}${L_ERR_NO_URL}${N}"
  echo "  ${D}${L_ERR_HELP}${N}"
  exit 1
fi

# --- Info mode ---
if [[ "$INFO_ONLY" == true ]]; then
  echo ""
  echo "${LINE}"
  echo "${C}  ${L_FETCHING}${N}"
  echo "${LINE}"
  echo ""

  YT_ARGS=(--ignore-config --dump-json --no-download)
  if [[ "$NO_COOKIE" == false ]]; then
    YT_ARGS+=(--cookies-from-browser "$BROWSER")
  fi

  RAW_JSON=$(yt-dlp "${YT_ARGS[@]}" "$URL" 2>/dev/null) || {
    echo "${R}${L_ERR_FETCH}${N}"
    exit 1
  }

  echo "$RAW_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
dur = d.get('duration', 0)
h, m, s = dur // 3600, (dur % 3600) // 60, dur % 60
dur_str = f'{h}:{m:02d}:{s:02d}' if h else f'{m}:{s:02d}'
upload = d.get('upload_date', '')
if upload:
    upload = f'{upload[:4]}-{upload[4:6]}-{upload[6:]}'

labels = {
    'title': '${L_PY_TITLE}',
    'channel': '${L_PY_CHANNEL}',
    'duration': '${L_PY_DURATION}',
    'uploaded': '${L_PY_UPLOADED}',
    'views': '${L_PY_VIEWS}',
    'likes': '${L_PY_LIKES}',
    'formats': '${L_PY_FORMATS}',
}

W = '\033[1;37m'
G = '\033[32m'
N = '\033[0m'

print(f'  {W}{labels[\"title\"]}{N}    {d.get(\"title\", \"N/A\")}')
print(f'  {W}{labels[\"channel\"]}{N}  {d.get(\"channel\", \"N/A\")}')
print(f'  {W}{labels[\"duration\"]}{N}    {dur_str}')
print(f'  {W}{labels[\"uploaded\"]}{N}      {upload}')
vc = d.get('view_count')
lc = d.get('like_count')
print(f'  {W}{labels[\"views\"]}{N}    {vc:,}' if vc is not None else f'  {W}{labels[\"views\"]}{N}    N/A')
print(f'  {W}{labels[\"likes\"]}{N}      {lc:,}' if lc is not None else f'  {W}{labels[\"likes\"]}{N}      N/A')
print()
print(f'  {W}{labels[\"formats\"]}{N}')
fmts = d.get('formats', [])
seen = set()
for f in fmts:
    h = f.get('height')
    if h and h not in seen:
        seen.add(h)
for h in sorted(seen, reverse=True):
    print(f'    {G}{h}p{N}')
print()
print(f'  {W}URL:{N} {d.get(\"webpage_url\", \"N/A\")}')
"
  echo ""
  exit 0
fi

# --- Build yt-dlp args ---
YT_ARGS=(--ignore-config)

# Cookies
if [[ "$NO_COOKIE" == false ]]; then
  YT_ARGS+=(--cookies-from-browser "$BROWSER")
fi

# Format
if [[ "$AUDIO_ONLY" == true ]]; then
  YT_ARGS+=(-f "bestaudio[ext=m4a]/bestaudio" -x --audio-format m4a)
elif [[ -n "$QUALITY" ]]; then
  YT_ARGS+=(-f "bestvideo[height<=${QUALITY}]+bestaudio/best[height<=${QUALITY}]")
else
  YT_ARGS+=(-f "bestvideo+bestaudio/best")
fi

# Merge format
if [[ "$AUDIO_ONLY" == false ]]; then
  YT_ARGS+=(--merge-output-format mp4)
fi

# Thumbnail, subtitles, description
YT_ARGS+=(--write-thumbnail --convert-thumbnails jpg)
YT_ARGS+=(--write-subs --write-auto-subs --sub-langs all)
YT_ARGS+=(--write-description)

# Output template
if [[ "$PLAYLIST_MODE" == true ]]; then
  YT_ARGS+=(--yes-playlist)
  YT_ARGS+=(-o "${BASE_DIR}/%(channel)s/%(playlist_title)s/%(playlist_index)03d_%(title)s/%(playlist_index)03d_%(title)s.%(ext)s")
else
  YT_ARGS+=(--no-playlist)
  YT_ARGS+=(-o "${BASE_DIR}/%(channel)s/%(title)s/%(title)s.%(ext)s")
fi

# Extra args
if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
  YT_ARGS+=("${EXTRA_ARGS[@]}")
fi

# --- Pre-execution summary ---
echo ""
echo "${LINE}"
echo "${C}  ${L_TITLE}${N}  ${D}${L_STARTING}${N}"
echo "${LINE}"
echo ""
echo "  ${W}${L_URL}${N}        ${URL}"
if [[ "$AUDIO_ONLY" == true ]]; then
  echo "  ${W}${L_MODE}${N}      ${Y}${L_MODE_AUDIO}${N}"
elif [[ -n "$QUALITY" ]]; then
  echo "  ${W}${L_QUALITY}${N}        ${G}${QUALITY}p${N}"
else
  echo "  ${W}${L_QUALITY}${N}        ${G}${L_QUALITY_BEST}${N}"
fi
echo "  ${W}${L_SAVETO}${N}      ${BASE_DIR}/"
if [[ "$PLAYLIST_MODE" == true ]]; then
  echo "  ${W}${L_PLAYLIST}${N} ${G}ON${N}"
fi
if [[ "$NO_COOKIE" == true ]]; then
  echo "  ${W}${L_COOKIE}${N}    ${Y}${L_COOKIE_NONE}${N}"
else
  echo "  ${W}${L_COOKIE}${N}    ${BROWSER}"
fi
if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
  echo "  ${W}${L_EXTRA}${N}    ${EXTRA_ARGS[*]}"
fi
echo ""
echo "${LINE}"
echo ""

# --- Execute ---
yt-dlp "${YT_ARGS[@]}" "$URL"

echo ""
echo "${LINE}"
echo "${G}  ${L_DONE}${N}"
echo "${LINE}"
echo ""
