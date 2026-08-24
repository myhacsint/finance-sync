#!/bin/bash
set -euo pipefail

SOURCE=${1:?Quelle fehlt: HKCM oder FRIEDRICH}
AFTER=${2:-}
if [[ -z "${AFTER}" ]]; then
  AFTER=$(/bin/date --date='3 days ago' --iso-8601=seconds)
fi
ROOT=/mnt/user/appdata/finance-hub/newsletter-worker
LOG="${ROOT}/runs.log"
case "${SOURCE}" in
  HKCM) QUERY=HKCM ;;
  FRIEDRICH) QUERY="Friedrich Report" ;;
  *) echo "Unbekannte Quelle: ${SOURCE}" >&2; exit 2 ;;
esac

args=(
  /usr/bin/docker exec
  -e "INVESTMENT_NEWSLETTER_QUERY=${QUERY}"
  -e INVESTMENT_MODEL=gpt-5.6-terra
  -e INVESTMENT_FALLBACK_MODEL=gpt-5.6-sol
  -e INVESTMENT_REASONING_EFFORT=medium
)
args+=(-e "INVESTMENT_AFTER=${AFTER}")
args+=(FinanceNewsletterWorker node --experimental-sqlite /app/dist/newsletter-worker.js)

{
  echo "$(/bin/date -u +%FT%TZ) START ${SOURCE} after=${AFTER}"
  /usr/bin/flock -w 5 "${ROOT}/worker.lock" "${args[@]}"
  echo "$(/bin/date -u +%FT%TZ) SUCCESS ${SOURCE}"
} >>"${LOG}" 2>&1
