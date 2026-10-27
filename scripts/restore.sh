#!/usr/bin/env sh
# Restore a backup archive. Usage: MONGO_URI=... ./scripts/restore.sh backups/aurum-2026-01-01_0300.archive.gz
# --drop replaces existing collections. Test restores regularly on a staging database first.
set -eu
: "${MONGO_URI:?MONGO_URI is required}"
: "${1:?Path to a backup archive is required}"
printf 'Restore %s into %s? This replaces existing data. Type YES: ' "$1" "$MONGO_URI"
read -r answer
[ "$answer" = "YES" ] || { echo "Aborted"; exit 1; }
mongorestore --uri="$MONGO_URI" --archive="$1" --gzip --drop
echo "Restore complete"
