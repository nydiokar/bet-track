#!/usr/bin/env bash
set -euo pipefail

DB_PATH=${1:-/var/www/bet-track/data/bet-track.sqlite}
BACKUP_DIR=${2:-/var/backups/bet-track}
DAYS_TO_KEEP=${3:-30}

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
cp "$DB_PATH" "$BACKUP_DIR/bet-track-$STAMP.sqlite"
find "$BACKUP_DIR" -name 'bet-track-*.sqlite' -mtime +"$DAYS_TO_KEEP" -delete

echo "Backup complete: $BACKUP_DIR/bet-track-$STAMP.sqlite"