#!/usr/bin/env bash
# Optional off-site copy of SQLite backups (requires an rclone remote configured by the owner,
# e.g. Backblaze B2 / Cloudflare R2 / any S3). Schedule with cron as the engine user:
#   17 3 * * * bash /opt/mapaimprez/engine/deploy/offsite-backup.sh mapaimprez-backup:engine
set -euo pipefail
REMOTE="${1:?usage: offsite-backup.sh <rclone-remote:path>}"
VOLUME_DIR="$(docker volume inspect --format '{{ .Mountpoint }}' deploy_engine-backups 2>/dev/null || true)"
[ -n "$VOLUME_DIR" ] || { echo "backup volume not found" >&2; exit 1; }
rclone copy --max-age 48h "$VOLUME_DIR" "$REMOTE" --include 'engine-*.sqlite'
rclone delete --min-age 60d "$REMOTE" --include 'engine-*.sqlite'
