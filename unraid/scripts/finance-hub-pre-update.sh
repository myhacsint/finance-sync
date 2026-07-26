#!/bin/bash
#arrayStarted=true
set -euo pipefail

BACKUP_ROOT=/mnt/user/backup/finance-hub
STAMP=$(/bin/date -u +%Y-%m-%dT%H-%M-%SZ)
/usr/bin/install -d -m 0750 "${BACKUP_ROOT}/update-manifests"

for container in ActualServer Ghostfolio FinanceSync Ghostfolio-Redis Ghostfolio-Postgres; do
  if /usr/bin/docker inspect "${container}" >/dev/null 2>&1; then
    /usr/bin/docker inspect \
      --format '{{.Name}} image={{.Config.Image}} id={{.Image}}' "${container}"
  fi
done > "${BACKUP_ROOT}/update-manifests/${STAMP}.txt"

/bin/bash "/boot/config/plugins/user.scripts/scripts/Finance Hub - Backup/script"
