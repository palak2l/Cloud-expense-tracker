#!/usr/bin/env bash
set -euo pipefail
# Secure SQLite backup for Ubuntu/EC2. Run from the app directory, or via cron.
# Example cron (daily 02:15): 15 2 * * * /usr/bin/node /home/ubuntu/cloud-expense-tracker/scripts/backup-db.js

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
/usr/bin/node "$APP_DIR/scripts/backup-db.js"

# Keep the last 14 backups only
BACKUP_DIR="$APP_DIR/backups"
if [[ -d "$BACKUP_DIR" ]]; then
  ls -1t "$BACKUP_DIR"/expense-tracker-*.sqlite | tail -n +15 | xargs -r rm --
fi
