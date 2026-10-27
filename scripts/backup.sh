#!/usr/bin/env sh
# Nightly MongoDB backup. Usage: MONGO_URI=... BACKUP_DIR=/var/backups/aurum ./scripts/backup.sh
# Keeps the last $KEEP_DAYS days. Copy the archives off-site (S3, Google Drive, another server).
set -eu
: "${MONGO_URI:?MONGO_URI is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/aurum-$(date +%Y-%m-%d_%H%M).archive.gz"
mongodump --uri="$MONGO_URI" --archive="$FILE" --gzip
echo "Backup written to $FILE"
find "$BACKUP_DIR" -name 'aurum-*.archive.gz' -mtime +"$KEEP_DAYS" -delete
