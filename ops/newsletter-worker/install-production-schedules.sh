#!/bin/bash
set -euo pipefail

SCHEDULE=/boot/config/plugins/user.scripts/schedule.json
TMP=$(/usr/bin/mktemp)
UPDATE_OLD="/boot/config/plugins/user.scripts/scripts/Finance Newsletter Worker - Update/script"

/usr/bin/jq \
  --arg update "/boot/config/plugins/user.scripts/scripts/FinanceNewsletterWorker-Update/script" \
  --arg hkcm1 "/boot/config/plugins/user.scripts/scripts/FinanceNewsletter-HKCM-Afternoon/script" \
  --arg hkcm2 "/boot/config/plugins/user.scripts/scripts/FinanceNewsletter-HKCM-Evening/script" \
  --arg hkcm3 "/boot/config/plugins/user.scripts/scripts/FinanceNewsletter-HKCM-Saturday/script" \
  --arg fr1 "/boot/config/plugins/user.scripts/scripts/FinanceNewsletter-Friedrich-Daily/script" \
  --arg fr2 "/boot/config/plugins/user.scripts/scripts/FinanceNewsletter-Friedrich-Thursday-Late/script" \
  --arg old "${UPDATE_OLD}" \
  'del(.[$old])
   | .[$update]={script:$update,frequency:"custom",id:"scheduleFinanceNewsletterWorkerUpdate",custom:"30 3 * * 1"}
   | .[$hkcm1]={script:$hkcm1,frequency:"custom",id:"scheduleFinanceNewsletterHKCMAfternoon",custom:"30 14 * * 1-5"}
   | .[$hkcm2]={script:$hkcm2,frequency:"custom",id:"scheduleFinanceNewsletterHKCMEvening",custom:"45 20 * * 1-5"}
   | .[$hkcm3]={script:$hkcm3,frequency:"custom",id:"scheduleFinanceNewsletterHKCMSaturday",custom:"30 11 * * 6"}
   | .[$fr1]={script:$fr1,frequency:"custom",id:"scheduleFinanceNewsletterFriedrichDaily",custom:"0 20 * * *"}
   | .[$fr2]={script:$fr2,frequency:"custom",id:"scheduleFinanceNewsletterFriedrichThursdayLate",custom:"45 22 * * 4"}' \
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
