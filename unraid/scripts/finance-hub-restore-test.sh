#!/bin/bash
#arrayStarted=true
set -euo pipefail

LATEST_DUMP=$(/usr/bin/find /mnt/user/backup/finance-hub/daily -type f -name 'ghostfolio-*.dump' -printf '%T@ %p\n' \
  | /usr/bin/sort -n | /usr/bin/tail -1 | /usr/bin/cut -d' ' -f2-)

if [[ -z "${LATEST_DUMP}" ]]; then
  echo "Kein Ghostfolio-Dump gefunden." >&2
  exit 1
fi

TEST_DB="ghostfolio_restore_test_$RANDOM"
/usr/bin/docker exec Ghostfolio-Postgres createdb --username=ghostfolio "${TEST_DB}"
cleanup() {
  /usr/bin/docker exec Ghostfolio-Postgres dropdb --if-exists --username=ghostfolio "${TEST_DB}" >/dev/null
}
trap cleanup EXIT

/usr/bin/docker exec -i Ghostfolio-Postgres \
  pg_restore --exit-on-error --no-owner --username=ghostfolio --dbname="${TEST_DB}" \
  < "${LATEST_DUMP}"

TABLES=$(/usr/bin/docker exec Ghostfolio-Postgres \
  psql --tuples-only --no-align --username=ghostfolio --dbname="${TEST_DB}" \
  --command="SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")

if [[ "${TABLES}" -lt 1 ]]; then
  echo "Wiederherstellungstest hat keine Tabellen gefunden." >&2
  exit 1
fi
echo "Wiederherstellungstest erfolgreich: ${TABLES} Tabellen."
