#!/bin/bash
# common.sh — shared utilities for ytdl server scripts
# shellcheck disable=SC2034

# --- Color definitions (matches bin/ytdl.sh) ---
C=$'\033[36m'     # cyan
Y=$'\033[33m'     # yellow
G=$'\033[32m'     # green
R=$'\033[31m'     # red
W=$'\033[1;37m'   # white bold
D=$'\033[2m'      # dim
N=$'\033[0m'      # reset

# --- Configuration loader ---
load_config() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

  # Load defaults
  local default_env="${script_dir}/scripts/config/default.env"
  if [[ -f "$default_env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$default_env"
    set +a
  fi

  # Override with user config
  local user_env="${script_dir}/.ytdl-server.env"
  if [[ -f "$user_env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$user_env"
    set +a
  fi
}

# --- JSON output helpers (for OpenClaw exec) ---
json_success() {
  local payload="$1"
  printf '{"status":"success","data":%s}\n' "$payload"
}

json_error() {
  local code="$1"
  local message="$2"
  # Escape double quotes and backslashes in message
  message="${message//\\/\\\\}"
  message="${message//\"/\\\"}"
  printf '{"status":"error","code":"%s","message":"%s"}\n' "$code" "$message"
}

# --- Logging (to stderr so stdout stays clean for JSON) ---
log_info() {
  echo "${C}[info]${N} $*" >&2
}

log_warn() {
  echo "${Y}[warn]${N} $*" >&2
}

log_error() {
  echo "${R}[error]${N} $*" >&2
}

# --- Require commands ---
require_command() {
  local cmd="$1"
  local install_hint="${2:-}"
  if ! command -v "$cmd" &>/dev/null; then
    log_error "$cmd not found"
    [[ -n "$install_hint" ]] && log_error "Install: $install_hint"
    return 1
  fi
}
