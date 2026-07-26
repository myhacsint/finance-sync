#!/bin/bash
#arrayStarted=true
set -euo pipefail

BACKUP_ROOT=/mnt/user/backup/finance-hub
ARCHIVE_ROOT=/mnt/user/finance-archive
SECRET_ROOT=/mnt/user/appdata/finance-hub/secrets
STAMP=$(/bin/date -u +%Y-%m-%dT%H-%M-%SZ)
DAY=$(/bin/date -u +%Y-%m-%d)
MONTH=$(/bin/date -u +%Y-%m)
DAILY_DIR="${BACKUP_ROOT}/daily/${DAY}"
MONTHLY_DIR="${BACKUP_ROOT}/monthly/${MONTH}"

/usr/bin/install -d -m 0750 "${DAILY_DIR}" "${BACKUP_ROOT}/monthly"

ADMIN_TOKEN=$(/bin/cat "${SECRET_ROOT}/admin-token")
/usr/bin/curl --fail --silent --show-error \
  -X POST -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  http://127.0.0.1:8080/api/backup >/dev/null
unset ADMIN_TOKEN

/usr/bin/docker exec Ghostfolio-Postgres \
  pg_dump --format=custom --no-owner --username=ghostfolio --dbname=ghostfolio \
  > "${DAILY_DIR}/ghostfolio-${STAMP}.dump"

/bin/cp --reflink=auto "${ARCHIVE_ROOT}/normalized/finance-snapshot.sqlite" \
  "${DAILY_DIR}/finance-${STAMP}.sqlite"

if [[ ! -d "${MONTHLY_DIR}" ]]; then
  /bin/cp -a --reflink=auto "${DAILY_DIR}" "${MONTHLY_DIR}"
fi

/usr/bin/find "${BACKUP_ROOT}/daily" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec /bin/rm -rf -- {} +
/usr/bin/find "${BACKUP_ROOT}/monthly" -mindepth 1 -maxdepth 1 -type d -mtime +370 -exec /bin/rm -rf -- {} +
/usr/bin/touch "${BACKUP_ROOT}/last-success"
/bin/chown root:10001 "${BACKUP_ROOT}" "${BACKUP_ROOT}/last-success"
/bin/chmod 0750 "${BACKUP_ROOT}"
/bin/chmod 0640 "${BACKUP_ROOT}/last-success"
