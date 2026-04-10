#!/usr/bin/env bash
# backup-db.sh — Backup PostgreSQL retirement_saas to Google Drive via rclone
#
# Usage:
#   ./tools/backup-db.sh              # Full backup + upload to Google Drive
#   ./tools/backup-db.sh --local-only # Backup locally, skip Google Drive
#   ./tools/backup-db.sh --restore FILENAME  # Restore from a backup file
#
# Prerequisites:
#   - PostgreSQL pg_dump available
#   - rclone configured with remote "gdrive" (run: rclone config)
#   - PGPASSWORD or .pgpass configured
#
# Schedule: Windows Task Scheduler or cron — daily at 2:00 AM

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────
DB_NAME="${POSTGRES_DB:-retirement_saas}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
PG_DUMP="/c/Program Files/PostgreSQL/16/bin/pg_dump"
PG_RESTORE="/c/Program Files/PostgreSQL/16/bin/pg_restore"

LOCAL_BACKUP_DIR="${BACKUP_DIR:-D:/backups/retirement-db}"
GDRIVE_REMOTE="gdrive"
GDRIVE_PATH="retirement-backups"
KEEP_LOCAL_DAYS=7
KEEP_GDRIVE_DAYS=30

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="retirement_saas_${TIMESTAMP}.sql.gz"

LOCAL_ONLY=false
RESTORE_FILE=""

for arg in "$@"; do
  case "$arg" in
    --local-only) LOCAL_ONLY=true ;;
    --restore)    shift; RESTORE_FILE="$1" ;;
  esac
done

# ─── Restore mode ─────────────────────────────────────────────────────────
if [ -n "$RESTORE_FILE" ]; then
  echo "=== Restoring from: $RESTORE_FILE ==="
  if [[ "$RESTORE_FILE" == *.gz ]]; then
    gunzip -c "$RESTORE_FILE" | PGPASSWORD="${PGPASSWORD:?PGPASSWORD environment variable must be set}" \
      "/c/Program Files/PostgreSQL/16/bin/psql" -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" 2>&1
  else
    PGPASSWORD="${PGPASSWORD:?PGPASSWORD environment variable must be set}" \
      "/c/Program Files/PostgreSQL/16/bin/psql" -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -f "$RESTORE_FILE" 2>&1
  fi
  echo "Restore complete."
  exit 0
fi

# ─── Backup ───────────────────────────────────────────────────────────────
echo "=== PostgreSQL Backup ==="
echo "  Database: $DB_NAME"
echo "  Time:     $(date)"
echo ""

# Create local backup directory
mkdir -p "$LOCAL_BACKUP_DIR"

# Dump database (compressed)
echo "Dumping $DB_NAME..."
PGPASSWORD="${PGPASSWORD:?PGPASSWORD environment variable must be set}" "$PG_DUMP" \
  -U "$DB_USER" \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --format=plain \
  | gzip > "$LOCAL_BACKUP_DIR/$BACKUP_FILE"

FILE_SIZE=$(du -h "$LOCAL_BACKUP_DIR/$BACKUP_FILE" | cut -f1)
echo "  Saved: $LOCAL_BACKUP_DIR/$BACKUP_FILE ($FILE_SIZE)"

# ─── Upload to Google Drive ──────────────────────────────────────────────
if ! $LOCAL_ONLY; then
  echo ""
  echo "Uploading to Google Drive..."

  # Check if rclone remote exists
  if rclone listremotes 2>/dev/null | grep -q "^${GDRIVE_REMOTE}:"; then
    rclone copy "$LOCAL_BACKUP_DIR/$BACKUP_FILE" "${GDRIVE_REMOTE}:${GDRIVE_PATH}/" \
      --progress --stats-one-line 2>&1
    echo "  Uploaded to ${GDRIVE_REMOTE}:${GDRIVE_PATH}/${BACKUP_FILE}"

    # Clean old Google Drive backups (keep KEEP_GDRIVE_DAYS days)
    echo ""
    echo "Cleaning Google Drive backups older than ${KEEP_GDRIVE_DAYS} days..."
    rclone delete "${GDRIVE_REMOTE}:${GDRIVE_PATH}/" \
      --min-age "${KEEP_GDRIVE_DAYS}d" 2>/dev/null || true
  else
    echo "  WARNING: rclone remote '${GDRIVE_REMOTE}' not configured."
    echo "  Run: rclone config"
    echo "  Skipping Google Drive upload."
  fi
fi

# ─── Clean old local backups ─────────────────────────────────────────────
echo ""
echo "Cleaning local backups older than ${KEEP_LOCAL_DAYS} days..."
find "$LOCAL_BACKUP_DIR" -name "retirement_saas_*.sql.gz" -mtime "+${KEEP_LOCAL_DAYS}" -delete 2>/dev/null || true

# List current backups
echo ""
echo "=== Current backups ==="
echo "Local ($LOCAL_BACKUP_DIR):"
ls -lh "$LOCAL_BACKUP_DIR"/retirement_saas_*.sql.gz 2>/dev/null | tail -7 || echo "  (none)"

if ! $LOCAL_ONLY && rclone listremotes 2>/dev/null | grep -q "^${GDRIVE_REMOTE}:"; then
  echo ""
  echo "Google Drive (${GDRIVE_REMOTE}:${GDRIVE_PATH}/):"
  rclone ls "${GDRIVE_REMOTE}:${GDRIVE_PATH}/" 2>/dev/null | tail -7 || echo "  (none)"
fi

echo ""
echo "=== Backup complete ==="
