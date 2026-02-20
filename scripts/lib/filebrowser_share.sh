#!/bin/bash
# filebrowser_share.sh — FileBrowser REST API share link generation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

FB_TOKEN=""

filebrowser_login() {
  local username="${YTDL_FB_USERNAME:-admin}"
  local password="${YTDL_FB_PASSWORD:-admin}"

  log_info "Logging in to FileBrowser: ${YTDL_FB_URL}"
  FB_TOKEN=$(curl -s -X POST "${YTDL_FB_URL}/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${username}\",\"password\":\"${password}\"}" 2>/dev/null)

  if [[ -z "$FB_TOKEN" || "$FB_TOKEN" == "null" || "$FB_TOKEN" == *"error"* ]]; then
    log_error "Failed to login to FileBrowser"
    FB_TOKEN=""
    return 1
  fi
}

filebrowser_create_share() {
  local share_path="$1"
  local expires="${2:-}"
  local password="${3:-}"

  if [[ -z "$FB_TOKEN" ]]; then
    log_error "Not logged in to FileBrowser. Call filebrowser_login first."
    return 1
  fi

  # Build request body
  local body="{}"
  if [[ -n "$expires" || -n "$password" ]]; then
    body="{"
    local has_field=false
    if [[ -n "$expires" ]]; then
      body+="\"expires\":\"${expires}\""
      has_field=true
    fi
    if [[ -n "$password" ]]; then
      [[ "$has_field" == "true" ]] && body+=","
      # Escape password for JSON
      local escaped_pw="${password//\\/\\\\}"
      escaped_pw="${escaped_pw//\"/\\\"}"
      body+="\"password\":\"${escaped_pw}\""
    fi
    body+="}"
  fi

  log_info "Creating share for: ${share_path}"
  local response
  response=$(curl -s -X POST "${YTDL_FB_URL}/api/share/${share_path}" \
    -H "X-Auth: ${FB_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$body" 2>/dev/null)

  if [[ -z "$response" ]]; then
    log_error "Failed to create share"
    return 1
  fi

  # Extract hash from response
  local hash
  hash=$(echo "$response" | grep -o '"hash":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [[ -z "$hash" ]]; then
    log_error "Failed to extract share hash from response: $response"
    return 1
  fi

  echo "$hash"
}

filebrowser_get_stream_url() {
  local hash="$1"
  local filename="$2"

  echo "${YTDL_FB_URL}/api/public/dl/${hash}/${filename}"
}
