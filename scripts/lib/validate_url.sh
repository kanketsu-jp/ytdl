#!/bin/bash
# validate_url.sh — URL validation with injection prevention

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

validate_url() {
  local url="$1"
  local check_reachable="${2:-false}"

  # Empty check
  if [[ -z "$url" ]]; then
    log_error "URL is empty"
    return 1
  fi

  # Length limit (2048 chars)
  if [[ ${#url} -gt 2048 ]]; then
    log_error "URL exceeds 2048 character limit"
    return 1
  fi

  # Protocol restriction: http:// or https:// only
  if [[ ! "$url" =~ ^https?:// ]]; then
    log_error "URL must start with http:// or https://"
    return 1
  fi

  # Shell injection prevention: reject dangerous characters
  if [[ "$url" =~ [;\|\&\$\`\'\"\(\)\{\}\<\>\\] || "$url" =~ $'\n' || "$url" =~ $'\r' ]]; then
    log_error "URL contains disallowed characters"
    return 1
  fi

  # Optional: reachability check via yt-dlp --simulate
  if [[ "$check_reachable" == "true" ]]; then
    if ! yt-dlp --simulate --ignore-config --no-warnings "$url" &>/dev/null; then
      log_error "URL is not reachable or not supported by yt-dlp"
      return 1
    fi
  fi

  return 0
}
