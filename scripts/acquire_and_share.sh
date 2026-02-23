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
URLS=()
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
      URLS+=("$2"); shift 2 ;;
    --info)
      ACTION="info"
      URLS+=("$2"); shift 2 ;;
    --url)
      ACTION="pipeline"
      URLS+=("$2"); shift 2 ;;
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
      echo "Usage: $0 <action> [action...] [options]"
      echo ""
      echo "Actions (can be repeated for batch processing):"
      echo "  --validate-url URL    Validate URL (repeatable)"
      echo "  --info URL            Get video info, no download (repeatable)"
      echo "  --url URL             Full pipeline: download → upload → share (repeatable)"
      echo ""
      echo "Options (for --url):"
      echo "  --mode video|audio    Download mode (default: video)"
      echo "  --quality <res>       Quality cap (360/480/720/1080/1440/2160)"
      echo "  --share method        Share method: presign|filebrowser|both (default: both)"
      echo "  --share-expiry dur    Share expiry (default: 7d)"
      echo "  --share-password pw   FileBrowser share password"
      echo "  --keep-local          Keep local temp files after upload"
      echo "  --output-format fmt   Output format: json|human (default: json)"
      echo ""
      echo "Examples:"
      echo "  $0 --url \"URL1\" --url \"URL2\" --mode audio"
      echo "  $0 --validate-url \"URL1\" --validate-url \"URL2\""
      echo "  $0 --info \"URL1\" --info \"URL2\""
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

if [[ ${#URLS[@]} -eq 0 ]]; then
  log_error "No URLs specified."
  exit 1
fi

# --- Action: validate ---
do_validate() {
  local results_json="["
  local first=true

  for url in "${URLS[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      results_json+=","
    fi

    local escaped_url="${url//\\/\\\\}"
    escaped_url="${escaped_url//\"/\\\"}"

    if validate_url "$url"; then
      results_json+="{\"url\":\"${escaped_url}\",\"valid\":true}"
    else
      results_json+="{\"url\":\"${escaped_url}\",\"valid\":false}"
    fi
  done

  results_json+="]"
  echo "{\"status\":\"success\",\"data\":${results_json}}"
}

# --- Action: info ---
do_info() {
  local ytdl_bin="${PROJECT_ROOT}/bin/ytdl.sh"
  if [[ ! -x "$ytdl_bin" ]]; then
    json_error "YTDL_NOT_FOUND" "bin/ytdl.sh not found or not executable"
    exit 1
  fi

  for url in "${URLS[@]}"; do
    validate_url "$url" || { json_error "INVALID_URL" "URL validation failed: $url"; exit 1; }
    bash "$ytdl_bin" -i --lang "${YTDL_LANG:-ja}" "$url"
  done
}

# --- Action: full pipeline (single URL) ---
do_single_pipeline() {
  local url="$1"

  validate_url "$url" || {
    echo "{\"url\":\"${url//\"/\\\"}\",\"status\":\"error\",\"code\":\"INVALID_URL\",\"message\":\"URL validation failed\"}"
    return 1
  }

  # 1. Fetch video metadata via yt-dlp --dump-json
  log_info "Fetching video metadata for: $url"
  local metadata
  metadata=$(yt-dlp --ignore-config --dump-json --no-download "$url" 2>/dev/null) || {
    echo "{\"url\":\"${url//\"/\\\"}\",\"status\":\"error\",\"code\":\"METADATA_FAILED\",\"message\":\"Failed to fetch video metadata\"}"
    return 1
  }

  local title channel duration
  title=$(echo "$metadata" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title','unknown'))" 2>/dev/null)
  channel=$(echo "$metadata" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('channel','unknown'))" 2>/dev/null)
  duration=$(echo "$metadata" | python3 -c "import sys,json; d=json.load(sys.stdin); dur=d.get('duration',0); print(f'{dur//3600}:{(dur%3600)//60:02d}:{dur%60:02d}' if dur else 'N/A')" 2>/dev/null)

  # 2. Create temp directory
  local temp_dir="${YTDL_TEMP_DIR:-/tmp/ytdl}/ytdl-$(date +%s)-$$-${RANDOM}"
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
  ytdl_args+=("$url")

  log_info "Starting download: $title"
  if ! bash "$ytdl_bin" "${ytdl_args[@]}" >&2; then
    rm -rf "$temp_dir"
    echo "{\"url\":\"${url//\"/\\\"}\",\"status\":\"error\",\"code\":\"DOWNLOAD_FAILED\",\"message\":\"Download failed\"}"
    return 1
  fi

  # 4. Find downloaded files
  local files=()
  while IFS= read -r -d '' f; do
    files+=("$(basename "$f")")
  done < <(find "$temp_dir" -type f -print0 2>/dev/null)

  if [[ ${#files[@]} -eq 0 ]]; then
    rm -rf "$temp_dir"
    echo "{\"url\":\"${url//\"/\\\"}\",\"status\":\"error\",\"code\":\"NO_FILES\",\"message\":\"No files downloaded\"}"
    return 1
  fi

  # 5. Upload to MinIO
  # Remote path: channel/title/
  local safe_channel safe_title
  safe_channel=$(echo "$channel" | tr -cd '[:alnum:]_ -' | head -c 100)
  safe_title=$(echo "$title" | tr -cd '[:alnum:]_ -' | head -c 100)
  local remote_path="${safe_channel}/${safe_title}"

  log_info "Uploading to MinIO: ${remote_path}"
  if ! minio_upload_directory "$temp_dir" "$remote_path"; then
    echo "{\"url\":\"${url//\"/\\\"}\",\"status\":\"error\",\"code\":\"UPLOAD_FAILED\",\"message\":\"MinIO upload failed\"}"
    return 1
  fi

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
  local escaped_url="${url//\\/\\\\}"
  escaped_url="${escaped_url//\"/\\\"}"

  # 9. Output result
  printf '{"url":"%s","status":"success","video":{"title":"%s","channel":"%s","duration":"%s"},"storage":{"bucket":"%s","path":"%s","files":%s},"share":{"presigned_urls":%s,"filebrowser":%s}}' \
    "$escaped_url" "$title" "$channel" "$duration" "$YTDL_MINIO_BUCKET" "$remote_path" \
    "$files_json" "$presigned_json" "$fb_json"
}

# --- Action: full pipeline (batch) ---
do_pipeline() {
  # Setup MinIO once for all URLs
  log_info "Configuring MinIO..."
  minio_configure_alias || { json_error "MINIO_CONFIG_FAILED" "MinIO configuration failed"; exit 1; }
  minio_ensure_bucket || { json_error "MINIO_BUCKET_FAILED" "MinIO bucket creation failed"; exit 1; }

  local total=${#URLS[@]}
  local succeeded=0
  local failed=0
  local results_json="["
  local first=true

  for url in "${URLS[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      results_json+=","
    fi

    log_info "Processing URL ($((succeeded + failed + 1))/${total}): $url"
    local result
    if result=$(do_single_pipeline "$url"); then
      succeeded=$((succeeded + 1))
    else
      failed=$((failed + 1))
    fi
    results_json+="$result"
  done

  results_json+="]"

  local output
  output=$(printf '{"status":"success","data":{"summary":{"total":%d,"succeeded":%d,"failed":%d},"results":%s}}' \
    "$total" "$succeeded" "$failed" "$results_json")

  if [[ "$OUTPUT_FORMAT" == "human" ]]; then
    log_info "=== Result ==="
    echo "$output" | python3 -m json.tool >&2 2>/dev/null || echo "$output" >&2
  fi

  echo "$output"
}

# --- Dispatch ---
case "$ACTION" in
  validate) do_validate ;;
  info)     do_info ;;
  pipeline) do_pipeline ;;
esac
