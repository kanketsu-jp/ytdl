#!/bin/bash
# acquire_and_share.sh — DL → upload → share pipeline (OpenClaw exec entry point)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${SCRIPT_DIR}/lib/common.sh"
source "${SCRIPT_DIR}/lib/validate_url.sh"
source "${SCRIPT_DIR}/lib/minio_upload.sh"
source "${SCRIPT_DIR}/lib/minio_presign.sh"
source "${SCRIPT_DIR}/lib/filebrowser_share.sh"
load_config

# --- Defaults ---
ACTION=""
URL=""
MODE="video"
QUALITY=""
SHARE_METHOD="${YTDL_SHARE_METHOD:-both}"
SHARE_EXPIRY="${YTDL_PRESIGN_EXPIRY:-7d}"
SHARE_PASSWORD=""
KEEP_LOCAL="${YTDL_KEEP_LOCAL:-false}"
OUTPUT_FORMAT="json"

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --validate-url)
      ACTION="validate"
      URL="$2"; shift 2 ;;
    --info)
      ACTION="info"
      URL="$2"; shift 2 ;;
    --url)
      ACTION="pipeline"
      URL="$2"; shift 2 ;;
    --mode)
      MODE="$2"; shift 2 ;;
    --quality)
      QUALITY="$2"; shift 2 ;;
    --share)
      SHARE_METHOD="$2"; shift 2 ;;
    --share-expiry)
      SHARE_EXPIRY="$2"; shift 2 ;;
    --share-password)
      SHARE_PASSWORD="$2"; shift 2 ;;
    --keep-local)
      KEEP_LOCAL="true"; shift ;;
    --output-format)
      OUTPUT_FORMAT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 --validate-url URL | --info URL | --url URL [options]"
      echo ""
      echo "Actions:"
      echo "  --validate-url URL    Validate URL only"
      echo "  --info URL            Get video info (no download)"
      echo "  --url URL             Full pipeline: download → upload → share"
      echo ""
      echo "Options (for --url):"
      echo "  --mode video|audio    Download mode (default: video)"
      echo "  --quality <res>       Quality cap (360/480/720/1080/1440/2160)"
      echo "  --share method        Share method: presign|filebrowser|both (default: both)"
      echo "  --share-expiry dur    Share expiry (default: 7d)"
      echo "  --share-password pw   FileBrowser share password"
      echo "  --keep-local          Keep local temp files after upload"
      echo "  --output-format fmt   Output format: json|human (default: json)"
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$ACTION" ]]; then
  log_error "No action specified. Use --validate-url, --info, or --url."
  exit 1
fi

# --- Action: validate ---
do_validate() {
  if validate_url "$URL"; then
    json_success '"URL is valid"'
  else
    json_error "INVALID_URL" "URL validation failed"
    exit 1
  fi
}

# --- Action: info ---
do_info() {
  validate_url "$URL" || { json_error "INVALID_URL" "URL validation failed"; exit 1; }

  local ytdl_bin="${PROJECT_ROOT}/bin/ytdl.sh"
  if [[ ! -x "$ytdl_bin" ]]; then
    json_error "YTDL_NOT_FOUND" "bin/ytdl.sh not found or not executable"
    exit 1
  fi

  bash "$ytdl_bin" -i --lang "${YTDL_LANG:-ja}" "$URL"
}

# --- Action: full pipeline ---
do_pipeline() {
  validate_url "$URL" || { json_error "INVALID_URL" "URL validation failed"; exit 1; }

  # 1. Fetch video metadata via yt-dlp --dump-json
  log_info "Fetching video metadata..."
  local metadata
  metadata=$(yt-dlp --ignore-config --dump-json --no-download "$URL" 2>/dev/null) || {
    json_error "METADATA_FAILED" "Failed to fetch video metadata"
    exit 1
  }

  local title channel duration
  title=$(echo "$metadata" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title','unknown'))" 2>/dev/null)
  channel=$(echo "$metadata" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('channel','unknown'))" 2>/dev/null)
  duration=$(echo "$metadata" | python3 -c "import sys,json; d=json.load(sys.stdin); dur=d.get('duration',0); print(f'{dur//3600}:{(dur%3600)//60:02d}:{dur%60:02d}' if dur else 'N/A')" 2>/dev/null)

  # 2. Create temp directory
  local temp_dir="${YTDL_TEMP_DIR:-/tmp/ytdl}/ytdl-$(date +%s)"
  mkdir -p "$temp_dir"
  log_info "Temp directory: $temp_dir"

  # 3. Build ytdl args and download
  local ytdl_bin="${PROJECT_ROOT}/bin/ytdl.sh"
  local ytdl_args=("--lang" "${YTDL_LANG:-ja}" "-o" "$temp_dir" "-n")

  if [[ "$MODE" == "audio" ]]; then
    ytdl_args+=("-a")
  fi
  if [[ -n "$QUALITY" ]]; then
    ytdl_args+=("-q" "$QUALITY")
  fi
  ytdl_args+=("$URL")

  log_info "Starting download: $title"
  if ! bash "$ytdl_bin" "${ytdl_args[@]}" >&2; then
    json_error "DOWNLOAD_FAILED" "Download failed for: $URL"
    rm -rf "$temp_dir"
    exit 1
  fi

  # 4. Find downloaded files
  local files=()
  while IFS= read -r -d '' f; do
    files+=("$(basename "$f")")
  done < <(find "$temp_dir" -type f -print0 2>/dev/null)

  if [[ ${#files[@]} -eq 0 ]]; then
    json_error "NO_FILES" "No files downloaded"
    rm -rf "$temp_dir"
    exit 1
  fi

  # 5. Upload to MinIO
  log_info "Configuring MinIO..."
  minio_configure_alias || { json_error "MINIO_CONFIG_FAILED" "MinIO configuration failed"; exit 1; }
  minio_ensure_bucket || { json_error "MINIO_BUCKET_FAILED" "MinIO bucket creation failed"; exit 1; }

  # Remote path: channel/title/
  local safe_channel safe_title
  safe_channel=$(echo "$channel" | tr -cd '[:alnum:]_ -' | head -c 100)
  safe_title=$(echo "$title" | tr -cd '[:alnum:]_ -' | head -c 100)
  local remote_path="${safe_channel}/${safe_title}"

  log_info "Uploading to MinIO: ${remote_path}"
  minio_upload_directory "$temp_dir" "$remote_path" || {
    json_error "UPLOAD_FAILED" "MinIO upload failed"
    exit 1
  }

  # 6. Generate share URLs
  local presigned_json="[]"
  local fb_json="null"

  if [[ "$SHARE_METHOD" == "presign" || "$SHARE_METHOD" == "both" ]]; then
    log_info "Generating presigned URLs..."
    presigned_json=$(minio_presign_directory "$remote_path" "$SHARE_EXPIRY")
  fi

  if [[ "$SHARE_METHOD" == "filebrowser" || "$SHARE_METHOD" == "both" ]]; then
    log_info "Creating FileBrowser share..."
    if filebrowser_login; then
      local fb_path="${YTDL_MINIO_BUCKET}/${remote_path}"
      local hash
      hash=$(filebrowser_create_share "$fb_path" "$SHARE_EXPIRY" "$SHARE_PASSWORD")
      if [[ -n "$hash" ]]; then
        local share_url="${YTDL_FB_URL}/share/${hash}"
        # Escape for JSON
        share_url="${share_url//\\/\\\\}"
        share_url="${share_url//\"/\\\"}"
        local pw_json="null"
        if [[ -n "$SHARE_PASSWORD" ]]; then
          local escaped_pw="${SHARE_PASSWORD//\\/\\\\}"
          escaped_pw="${escaped_pw//\"/\\\"}"
          pw_json="\"${escaped_pw}\""
        fi
        fb_json="{\"url\":\"${share_url}\",\"password\":${pw_json},\"expires\":\"${SHARE_EXPIRY}\"}"
      fi
    else
      log_warn "FileBrowser login failed, skipping share link"
    fi
  fi

  # 7. Cleanup temp files
  if [[ "$KEEP_LOCAL" != "true" ]]; then
    log_info "Cleaning up temp directory: $temp_dir"
    rm -rf "$temp_dir"
  else
    log_info "Keeping local files: $temp_dir"
  fi

  # 8. Build file list JSON
  local files_json="["
  local first=true
  for f in "${files[@]}"; do
    f="${f//\\/\\\\}"
    f="${f//\"/\\\"}"
    if [[ "$first" == "true" ]]; then
      first=false
    else
      files_json+=","
    fi
    files_json+="\"${f}\""
  done
  files_json+="]"

  # Escape metadata for JSON
  title="${title//\\/\\\\}"
  title="${title//\"/\\\"}"
  channel="${channel//\\/\\\\}"
  channel="${channel//\"/\\\"}"
  duration="${duration//\\/\\\\}"
  duration="${duration//\"/\\\"}"
  remote_path="${remote_path//\\/\\\\}"
  remote_path="${remote_path//\"/\\\"}"

  # 9. Output result
  local result
  result=$(printf '{
  "status": "success",
  "video": {"title": "%s", "channel": "%s", "duration": "%s"},
  "storage": {"bucket": "%s", "path": "%s", "files": %s},
  "share": {"presigned_urls": %s, "filebrowser": %s}
}' "$title" "$channel" "$duration" "$YTDL_MINIO_BUCKET" "$remote_path" \
     "$files_json" "$presigned_json" "$fb_json")

  if [[ "$OUTPUT_FORMAT" == "human" ]]; then
    log_info "=== Result ==="
    echo "$result" | python3 -m json.tool >&2 2>/dev/null || echo "$result" >&2
  fi

  echo "$result"
}

# --- Dispatch ---
case "$ACTION" in
  validate) do_validate ;;
  info)     do_info ;;
  pipeline) do_pipeline ;;
esac
