#!/usr/bin/env bash
# SQLite Database Backup Script
# Usage: ./scripts/backup-db.sh [DB_PATH] [BACKUP_DIR]
#
# Can be run standalone or via cron:
#   0 */6 * * * /app/scripts/backup-db.sh /app/data/trade.db /app/data/backups

set -uo pipefail

DB_PATH="${1:-./data/trade.db}"
BACKUP_DIR="${2:-./data/backups}"
RETENTION_DAYS="${DB_BACKUP_RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/trade_${TIMESTAMP}.db"

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: Database not found at $DB_PATH" >&2
  exit 1
fi

# Clean any leftover uncompressed backups from previous failed runs
find "$BACKUP_DIR" -name "trade_*.db" -not -name "trade_*.db.gz" -delete 2>/dev/null || true

# Checkpoint WAL before backup for operational cleanliness
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true

# Use SQLite .backup for consistent snapshot
if sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date -Iseconds)] Backup created: $BACKUP_FILE ($SIZE)"

  # Compress backup
  gzip "$BACKUP_FILE"
  echo "[$(date -Iseconds)] Compressed: ${BACKUP_FILE}.gz"

  # Remove backups older than RETENTION_DAYS
  find "$BACKUP_DIR" -name "trade_*.db.gz" -mtime +"$RETENTION_DAYS" -delete
  echo "[$(date -Iseconds)] Cleaned backups older than $RETENTION_DAYS days"
else
  echo "ERROR: Backup failed for $DB_PATH" >&2
  rm -f "$BACKUP_FILE" 2>/dev/null || true
  exit 1
fi
