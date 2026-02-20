#!/bin/bash
# setup_environment.sh — environment bootstrap for ytdl server
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${SCRIPT_DIR}/lib/common.sh"
load_config

# --- Subcommand dispatch ---
ACTION="${1:-}"

usage() {
  echo "Usage: $0 --check | --setup | --teardown | --status"
  echo ""
  echo "  --check      Check required tools and service health"
  echo "  --setup      Full setup (Docker, MinIO, FileBrowser)"
  echo "  --teardown   Stop and remove Docker services"
  echo "  --status     Show service status"
}

# --- Check tool availability ---
check_tool() {
  local tool="$1"
  command -v "$tool" &>/dev/null && echo "true" || echo "false"
}

# --- Check Docker Compose service health ---
check_service() {
  local service="$1"
  docker compose -f "${PROJECT_ROOT}/docker/docker-compose.yml" \
    ps --format json 2>/dev/null | grep -q "\"$service\"" && echo "true" || echo "false"
}

check_minio_health() {
  curl -sf "${YTDL_MINIO_ENDPOINT}/minio/health/live" &>/dev/null && echo "true" || echo "false"
}

check_filebrowser_health() {
  curl -sf "${YTDL_FB_URL}/api/health" &>/dev/null && echo "true" || echo "false"
}

# --- Actions ---
do_check() {
  local docker_ok=$(check_tool docker)
  local ytdl_ok=$(check_tool ytdl)
  local mc_ok=$(check_tool mc)
  local minio_ok=$(check_minio_health)
  local fb_ok=$(check_filebrowser_health)

  json_success "$(printf '{"docker":%s,"ytdl":%s,"mc":%s,"minio":%s,"filebrowser":%s}' \
    "$docker_ok" "$ytdl_ok" "$mc_ok" "$minio_ok" "$fb_ok")"
}

do_setup() {
  log_info "Starting environment setup..."

  # 1. Check required tools
  require_command docker "Install Docker Desktop: https://docker.com" || exit 1

  # 2. Install mc if needed
  if ! command -v mc &>/dev/null; then
    log_info "Installing MinIO client (mc)..."
    case "$(uname -s)" in
      Darwin)
        if command -v brew &>/dev/null; then
          brew install minio/stable/mc >&2
        else
          log_error "brew not found. Install mc manually: https://min.io/docs/minio/linux/reference/minio-mc.html"
          exit 1
        fi
        ;;
      Linux)
        curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /tmp/mc >&2
        chmod +x /tmp/mc
        sudo mv /tmp/mc /usr/local/bin/mc
        ;;
      *)
        log_error "Unsupported platform: $(uname -s)"
        exit 1
        ;;
    esac
  fi

  # 3. Copy .env.example if .env doesn't exist
  if [[ ! -f "${PROJECT_ROOT}/docker/.env" ]]; then
    log_info "Creating docker/.env from .env.example"
    cp "${PROJECT_ROOT}/docker/.env.example" "${PROJECT_ROOT}/docker/.env"
  fi

  # 4. Start Docker services
  log_info "Starting Docker services..."
  docker compose -f "${PROJECT_ROOT}/docker/docker-compose.yml" up -d >&2

  # 5. Wait for MinIO to be healthy
  log_info "Waiting for MinIO to be ready..."
  local retries=0
  while [[ $retries -lt 30 ]]; do
    if curl -sf "${YTDL_MINIO_ENDPOINT}/minio/health/live" &>/dev/null; then
      break
    fi
    sleep 1
    retries=$((retries + 1))
  done
  if [[ $retries -ge 30 ]]; then
    log_error "MinIO failed to start within 30 seconds"
    exit 1
  fi

  # 6. Configure MinIO alias and bucket
  source "${SCRIPT_DIR}/lib/minio_upload.sh"
  minio_configure_alias || exit 1
  minio_ensure_bucket || exit 1

  # 7. Health check
  local minio_ok=$(check_minio_health)
  local fb_ok=$(check_filebrowser_health)

  log_info "Setup complete"
  json_success "$(printf '{"minio":%s,"filebrowser":%s,"bucket":"%s"}' \
    "$minio_ok" "$fb_ok" "$YTDL_MINIO_BUCKET")"
}

do_teardown() {
  log_info "Stopping Docker services..."
  docker compose -f "${PROJECT_ROOT}/docker/docker-compose.yml" down >&2
  log_info "Services stopped"
  json_success '"teardown complete"'
}

do_status() {
  local minio_ok=$(check_minio_health)
  local fb_ok=$(check_filebrowser_health)

  # Get running containers
  local services
  services=$(docker compose -f "${PROJECT_ROOT}/docker/docker-compose.yml" \
    ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || echo "not running")

  log_info "Services:"
  echo "$services" >&2

  json_success "$(printf '{"minio":%s,"filebrowser":%s}' "$minio_ok" "$fb_ok")"
}

# --- Main ---
case "${ACTION}" in
  --check)    do_check ;;
  --setup)    do_setup ;;
  --teardown) do_teardown ;;
  --status)   do_status ;;
  *)          usage; exit 1 ;;
esac
