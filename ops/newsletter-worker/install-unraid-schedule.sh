#!/bin/bash
set -euo pipefail

SCRIPT_PATH="/boot/config/plugins/user.scripts/scripts/Finance Newsletter Worker - Update/script"
SCHEDULE=/boot/config/plugins/user.scripts/schedule.json
TMP=$(/usr/bin/mktemp)

/usr/bin/jq --arg path "${SCRIPT_PATH}" \
  '.[$path]={script:$path,frequency:"custom",id:"scheduleFinanceNewsletterWorkerUpdate",custom:"30 3 * * 1"}' \
  "${SCHEDULE}" >"${TMP}"
/usr/bin/install -m 0600 "${TMP}" "${SCHEDULE}"
/usr/bin/install -m 0600 "${TMP}" /tmp/user.scripts/schedule.json
/bin/rm -f "${TMP}"

{
  echo "# Generated cron schedule for user.scripts"
  /usr/bin/jq -r 'to_entries[] | select(.value.frequency=="custom" and .value.custom!="") | "\(.value.custom) /usr/local/emhttp/plugins/user.scripts/startCustom.php \(.value.script) > /dev/null 2>&1"' "${SCHEDULE}"
  echo
} >/boot/config/plugins/user.scripts/customSchedule.cron
/usr/local/sbin/update_cron
