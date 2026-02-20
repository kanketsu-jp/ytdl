#!/bin/bash
# minio_presign.sh — MinIO presigned URL generation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

minio_presign_url() {
  local remote_path="$1"
  local expiry="${2:-${YTDL_PRESIGN_EXPIRY:-7d}}"

  local output
  output=$(mc share download --expire "$expiry" \
    "${YTDL_MINIO_ALIAS}/${YTDL_MINIO_BUCKET}/${remote_path}" 2>/dev/null)

  if [[ $? -ne 0 ]]; then
    log_error "Failed to generate presigned URL for: $remote_path"
    return 1
  fi

  # mc share output format: "URL: https://..." or "Share: https://..."
  echo "$output" | grep -o 'http[s]*://[^ ]*' | head -1
}

minio_presign_directory() {
  local remote_dir="$1"
  local expiry="${2:-${YTDL_PRESIGN_EXPIRY:-7d}}"

  # List files in directory
  local files
  files=$(mc ls "${YTDL_MINIO_ALIAS}/${YTDL_MINIO_BUCKET}/${remote_dir}/" 2>/dev/null | awk '{print $NF}')

  if [[ -z "$files" ]]; then
    log_error "No files found in: $remote_dir"
    echo "[]"
    return 1
  fi

  # Build JSON array
  local json="["
  local first=true
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue

    local url
    url=$(minio_presign_url "${remote_dir}/${file}" "$expiry")
    if [[ -z "$url" ]]; then
      continue
    fi

    # Escape for JSON
    file="${file//\\/\\\\}"
    file="${file//\"/\\\"}"
    url="${url//\\/\\\\}"
    url="${url//\"/\\\"}"

    if [[ "$first" == "true" ]]; then
      first=false
    else
      json+=","
    fi
    json+="{\"file\":\"${file}\",\"url\":\"${url}\",\"expires\":\"${expiry}\"}"
  done <<< "$files"

  json+="]"
  echo "$json"
}
