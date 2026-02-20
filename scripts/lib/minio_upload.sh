#!/bin/bash
# minio_upload.sh — MinIO upload functions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

minio_configure_alias() {
  log_info "Configuring MinIO alias: ${YTDL_MINIO_ALIAS}"
  if ! mc alias set "$YTDL_MINIO_ALIAS" "$YTDL_MINIO_ENDPOINT" \
       "$YTDL_MINIO_ACCESS_KEY" "$YTDL_MINIO_SECRET_KEY" >/dev/null 2>&1; then
    log_error "Failed to configure MinIO alias"
    return 1
  fi
}

minio_ensure_bucket() {
  log_info "Ensuring bucket exists: ${YTDL_MINIO_BUCKET}"
  if ! mc mb --ignore-existing "${YTDL_MINIO_ALIAS}/${YTDL_MINIO_BUCKET}" >/dev/null 2>&1; then
    log_error "Failed to create bucket: ${YTDL_MINIO_BUCKET}"
    return 1
  fi
}

minio_upload_directory() {
  local local_dir="$1"
  local remote_path="$2"

  if [[ ! -d "$local_dir" ]]; then
    log_error "Directory not found: $local_dir"
    return 1
  fi

  log_info "Uploading directory: $local_dir → ${YTDL_MINIO_ALIAS}/${YTDL_MINIO_BUCKET}/${remote_path}/"
  if ! mc cp --recursive "${local_dir}/" "${YTDL_MINIO_ALIAS}/${YTDL_MINIO_BUCKET}/${remote_path}/" >/dev/null 2>&1; then
    log_error "Failed to upload directory"
    return 1
  fi
}

minio_upload_file() {
  local local_file="$1"
  local remote_path="$2"

  if [[ ! -f "$local_file" ]]; then
    log_error "File not found: $local_file"
    return 1
  fi

  log_info "Uploading file: $local_file → ${YTDL_MINIO_ALIAS}/${YTDL_MINIO_BUCKET}/${remote_path}"
  if ! mc cp "${local_file}" "${YTDL_MINIO_ALIAS}/${YTDL_MINIO_BUCKET}/${remote_path}" >/dev/null 2>&1; then
    log_error "Failed to upload file"
    return 1
  fi
}
