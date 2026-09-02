#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-latest}"
APPLY="${2:-}"
APP_DIR="${WA_FINANCE_APP_DIR:-/data/appdata/wa-finance}"
RUNTIME_DIR="$APP_DIR/runtime"
SECRET_DIR="$APP_DIR/secrets"
BACKUP_DIR="$APP_DIR/backups"
RESTORE_DIR="$BACKUP_DIR/restore"
PROJECT_ID="${FIREBASE_PROJECT_ID:-wa-finance-bot-i729}"
HOST_GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-$SECRET_DIR/google-application-credentials.json}"
IMAGE="${WA_FINANCE_BACKUP_IMAGE:-wa-finance-wa-finance-api:latest}"
PASS_FILE="$SECRET_DIR/backup-passphrase"

usage() {
  echo "Usage: $0 [latest|daily|weekly|monthly|manual] [--apply]" >&2
  exit 2
}
case "$MODE" in latest|daily|weekly|monthly|manual) ;; *) usage ;; esac
[[ -z "$APPLY" || "$APPLY" == "--apply" ]] || usage
[[ -s "$PASS_FILE" ]] || { echo "Backup passphrase lokal tidak ditemukan." >&2; exit 1; }

mkdir -p "$RESTORE_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="$(mktemp -d "$RESTORE_DIR/restore.${STAMP}.XXXXXX")"
cleanup() {
  if [[ -d "$WORK_DIR" && "$APPLY" != "--apply" ]]; then
    find "$WORK_DIR" -mindepth 1 -delete
    rmdir "$WORK_DIR"
  fi
}
trap cleanup EXIT

select_local() {
  local selected="$1"
  if [[ "$selected" == "latest" ]]; then
    find "$BACKUP_DIR" -mindepth 2 -maxdepth 2 -type f -name '*.tar.gz.enc' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-
  else
    find "$BACKUP_DIR/$selected" -maxdepth 1 -type f -name '*.tar.gz.enc' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-
  fi
}

download_monthly() {
  docker run --rm --user "$(id -u):$(id -g)" \
    -e FIREBASE_PROJECT_ID="$PROJECT_ID" \
    -e GOOGLE_APPLICATION_CREDENTIALS="/run/secrets/google-application-credentials.json" \
    -v "$HOST_GOOGLE_APPLICATION_CREDENTIALS:/run/secrets/google-application-credentials.json:ro" \
    -v "$WORK_DIR:/restore" \
    "$IMAGE" \
    node /app/scripts/wa-finance-firestore-backup.js download latest /restore/monthly.tar.gz.enc
}

if [[ "$MODE" == "monthly" ]]; then
  download_monthly
  ENC_LOCAL="$WORK_DIR/monthly.tar.gz.enc"
else
  ENC_LOCAL="$(select_local "$MODE")"
  [[ -n "$ENC_LOCAL" ]] || { echo "Backup lokal tidak ditemukan." >&2; exit 1; }
fi

EXPECTED_SHA="$(sha256sum "$ENC_LOCAL" | awk '{print $1}')"
ARCHIVE_LOCAL="$WORK_DIR/payload.tar.gz"
PAYLOAD_DIR="$WORK_DIR/payload"
openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass "file:$PASS_FILE" -in "$ENC_LOCAL" -out "$ARCHIVE_LOCAL"
mkdir -p "$PAYLOAD_DIR"
tar -C "$PAYLOAD_DIR" -xzf "$ARCHIVE_LOCAL"
ACTUAL_DB_SHA="$(sha256sum "$PAYLOAD_DIR/runtime/database.sqlite" | awk '{print $1}')"

echo "Backup: $ENC_LOCAL"
echo "Encrypted checksum: $EXPECTED_SHA"
echo "Database checksum: $ACTUAL_DB_SHA"
cat "$PAYLOAD_DIR/meta/manifest.json"
if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry-run selesai. Tambahkan --apply untuk memulihkan runtime."
  exit 0
fi

SAFETY="$BACKUP_DIR/pre-restore-runtime-$STAMP.tar.gz"
tar -C "$APP_DIR" -czf "$SAFETY" runtime
docker compose -f "$APP_DIR/docker-compose.yml" stop wa-finance-api
cp "$PAYLOAD_DIR/runtime/database.sqlite" "$RUNTIME_DIR/database.sqlite"
if [[ -f "$PAYLOAD_DIR/runtime/sessions.tar.gz" ]]; then
  mkdir -p "$RUNTIME_DIR/sessions"
  find "$RUNTIME_DIR/sessions" -mindepth 1 -delete
  tar -C "$RUNTIME_DIR" -xzf "$PAYLOAD_DIR/runtime/sessions.tar.gz"
fi
docker compose -f "$APP_DIR/docker-compose.yml" up -d wa-finance-api
echo "Restore selesai. Safety copy: $SAFETY"
