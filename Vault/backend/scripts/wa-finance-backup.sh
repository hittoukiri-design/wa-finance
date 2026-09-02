#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-daily}"
case "$MODE" in
  daily|weekly|monthly|manual) ;;
  *) echo "Usage: $0 [daily|weekly|monthly|manual]" >&2; exit 2 ;;
esac

APP_DIR="${WA_FINANCE_APP_DIR:-/data/appdata/wa-finance}"
RUNTIME_DIR="$APP_DIR/runtime"
SECRET_DIR="$APP_DIR/secrets"
BACKUP_DIR="$APP_DIR/backups"
WORK_ROOT="$BACKUP_DIR/work"
PROJECT_ID="${FIREBASE_PROJECT_ID:-wa-finance-bot-i729}"
HOST_GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-$SECRET_DIR/google-application-credentials.json}"
IMAGE="${WA_FINANCE_BACKUP_IMAGE:-wa-finance-wa-finance-api:latest}"
PASS_FILE="$SECRET_DIR/backup-passphrase"

mkdir -p "$SECRET_DIR" "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly" "$BACKUP_DIR/manual" "$BACKUP_DIR/logs" "$WORK_ROOT"
chmod 700 "$SECRET_DIR" "$BACKUP_DIR"

log() {
  printf '[%s] %s\n' "$(date -Is)" "$*"
}

ensure_passphrase() {
  if [[ ! -s "$PASS_FILE" ]]; then
    umask 077
    openssl rand -base64 48 > "$PASS_FILE"
  fi
  chmod 600 "$PASS_FILE"
}

cleanup() {
  if [[ -n "${WORK_DIR:-}" && -d "$WORK_DIR" ]]; then
    find "$WORK_DIR" -mindepth 1 -delete
    rmdir "$WORK_DIR"
  fi
}
trap cleanup EXIT

run_firestore_helper() {
  docker run --rm \
    -e FIREBASE_PROJECT_ID="$PROJECT_ID" \
    -e FIRESTORE_MONTHLY_BACKUP_RETENTION="${FIRESTORE_MONTHLY_BACKUP_RETENTION:-12}" \
    -e GOOGLE_APPLICATION_CREDENTIALS="/run/secrets/google-application-credentials.json" \
    -v "$HOST_GOOGLE_APPLICATION_CREDENTIALS:/run/secrets/google-application-credentials.json:ro" \
    -v "$BACKUP_DIR:/backups" \
    "$IMAGE" \
    node /app/scripts/wa-finance-firestore-backup.js "$@"
}

ensure_passphrase
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="$(mktemp -d "$WORK_ROOT/${MODE}.${STAMP}.XXXXXX")"
PAYLOAD="$WORK_DIR/payload"
mkdir -p "$PAYLOAD/runtime" "$PAYLOAD/config" "$PAYLOAD/meta"

log "Creating encrypted local $MODE backup."
docker run --rm -i \
  -v "$RUNTIME_DIR:/runtime:ro" \
  -v "$WORK_DIR:/work" \
  "$IMAGE" \
  node - <<'NODE'
const Database = require('better-sqlite3');
const db = new Database('/runtime/database.sqlite', { readonly: true, fileMustExist: true });
db.backup('/work/payload/runtime/database.sqlite')
  .then(() => db.close())
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
NODE

if [[ -d "$RUNTIME_DIR/sessions" ]]; then
  tar -C "$RUNTIME_DIR" -czf "$PAYLOAD/runtime/sessions.tar.gz" sessions
fi
if [[ -f "$APP_DIR/docker-compose.yml" ]]; then
  cp "$APP_DIR/docker-compose.yml" "$PAYLOAD/config/docker-compose.yml"
fi
if [[ -f "$APP_DIR/.env" ]]; then
  cp "$APP_DIR/.env" "$PAYLOAD/config/app.env"
fi

DB_SHA="$(sha256sum "$PAYLOAD/runtime/database.sqlite" | awk '{print $1}')"
SESSION_COUNT="$(find "$RUNTIME_DIR/sessions" -type f 2>/dev/null | wc -l | tr -d ' ')"
cat > "$PAYLOAD/meta/manifest.json" <<EOF
{
  "app": "WA Finance Gateway",
  "mode": "$MODE",
  "created_at_utc": "$STAMP",
  "database_sha256": "$DB_SHA",
  "session_file_count": $SESSION_COUNT,
  "encryption": "openssl aes-256-cbc pbkdf2 iter=200000",
  "monthly_remote_archive": $([[ "$MODE" == "monthly" ]] && echo true || echo false)
}
EOF

ARCHIVE="$BACKUP_DIR/$MODE/wa-finance-${MODE}-${STAMP}.tar.gz"
ENCRYPTED="$ARCHIVE.enc"
SHA_FILE="$ENCRYPTED.sha256"
tar -C "$PAYLOAD" -czf "$ARCHIVE" .
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass "file:$PASS_FILE" -in "$ARCHIVE" -out "$ENCRYPTED"
sha256sum "$ENCRYPTED" > "$SHA_FILE"
unlink "$ARCHIVE"

if [[ "$MODE" == "monthly" ]]; then
  log "Archiving encrypted monthly backup to Firestore."
  run_firestore_helper upload "/backups/monthly/$(basename "$ENCRYPTED")" "monthly-$STAMP"
fi

find "$BACKUP_DIR/daily" -type f -name '*.enc*' -mtime +30 -delete
find "$BACKUP_DIR/weekly" -type f -name '*.enc*' -mtime +180 -delete
find "$BACKUP_DIR/monthly" -type f -name '*.enc*' -mtime +370 -delete
find "$BACKUP_DIR/manual" -type f -name '*.enc*' -mtime +30 -delete
find "$BACKUP_DIR/logs" -type f -name '*.log' -mtime +45 -delete

log "Backup selesai: $ENCRYPTED"
