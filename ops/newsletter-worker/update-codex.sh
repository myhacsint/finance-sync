#!/bin/bash
#arrayStarted=true
set -euo pipefail

ROOT=/mnt/user/appdata/finance-hub/newsletter-worker
BUILD_ROOT="${ROOT}/update"
AUTH_ROOT="${ROOT}/codex"
WORKSPACE="${ROOT}/workspace"
FINANCE_DATA=/mnt/user/appdata/finance-hub/finance-sync
FINANCE_SECRETS=/mnt/user/appdata/finance-hub/secrets
CONTAINER=FinanceNewsletterWorker
REPOSITORY=finance-newsletter-worker
LOG="${ROOT}/update.log"
STATUS="${ROOT}/update-status.json"
CURRENT_VERSION=$(/usr/bin/docker exec "${CONTAINER}" codex --version | /usr/bin/awk '{print $2}')
LATEST_VERSION=$(/usr/bin/docker run --rm node:22-bookworm-slim npm view @openai/codex version)

/usr/bin/install -d -m 0755 "${BUILD_ROOT}"
/usr/bin/install -d -m 0750 "${WORKSPACE}"
/bin/chmod 0644 "${BUILD_ROOT}/smoke-schema.json" "${BUILD_ROOT}/smoke-prompt.txt"
if [[ "${CURRENT_VERSION}" == "${LATEST_VERSION}" && "${FORCE_CHECK:-0}" != "1" ]]; then
  /usr/bin/printf '{"state":"CURRENT","version":"%s","checkedAt":"%s"}\n' \
    "${CURRENT_VERSION}" "$(/bin/date -u +%FT%TZ)" >"${STATUS}"
  exit 0
fi

IMAGE="${REPOSITORY}:codex-${LATEST_VERSION}"
TEMP="${CONTAINER}-candidate"
cleanup() {
  /usr/bin/docker rm -f "${TEMP}" >/dev/null 2>&1 || true
  /bin/rm -f "${WORKSPACE}/smoke-output.json"
}
trap cleanup EXIT

run_update() {
  echo "$(/bin/date -u +%FT%TZ) building ${IMAGE} from ${CURRENT_VERSION}"
  /usr/bin/docker build --pull \
    --build-arg "CODEX_VERSION=${LATEST_VERSION}" \
    -t "${IMAGE}" -f "${BUILD_ROOT}/Dockerfile.newsletter-worker" "${BUILD_ROOT}" || return 1
  /usr/bin/docker run -d --name "${TEMP}" --read-only --user 10001:10001 \
    --tmpfs /tmp:rw,noexec,nosuid,size=128m,uid=10001,gid=10001 \
    --tmpfs /home/node/.npm:rw,noexec,nosuid,size=64m,uid=10001,gid=10001 \
    -v "${AUTH_ROOT}:/home/node/.codex" \
    -v "${WORKSPACE}:/workspace" \
    -v "${BUILD_ROOT}:/smoke:ro" \
    --network finance-hub "${IMAGE}" >/dev/null || return 1
  /usr/bin/docker exec "${TEMP}" codex login status || return 1
  /usr/bin/docker exec -i "${TEMP}" codex -a never exec \
    -m gpt-5.6-terra -c 'model_reasoning_effort="low"' \
    --sandbox read-only --skip-git-repo-check --ephemeral \
    --output-schema /smoke/smoke-schema.json \
    --output-last-message /workspace/smoke-output.json - \
    <"${BUILD_ROOT}/smoke-prompt.txt" || return 1
  /usr/bin/docker exec "${TEMP}" node -e \
    'const fs=require("fs");const x=JSON.parse(fs.readFileSync("/workspace/smoke-output.json","utf8"));if(x.instrument!=="Beispiel AG"||x.stance!=="NEUTRAL"||!Array.isArray(x.evidence)||!x.evidence.length)process.exit(1)' || return 1
  /usr/bin/docker rm -f "${TEMP}" >/dev/null
  /usr/bin/docker rm -f "${CONTAINER}" >/dev/null || return 1
  /usr/bin/docker run -d --name "${CONTAINER}" --restart unless-stopped --read-only --user 10001:10001 \
    --tmpfs /tmp:rw,noexec,nosuid,size=128m,uid=10001,gid=10001 \
    --tmpfs /home/node/.npm:rw,noexec,nosuid,size=64m,uid=10001,gid=10001 \
    -v "${AUTH_ROOT}:/home/node/.codex" \
    -v "${WORKSPACE}:/workspace" \
    -v "${FINANCE_DATA}:/app/data" \
    -v "${FINANCE_SECRETS}:/run/secrets:ro" \
    -e FINANCE_DATA_DIR=/app/data \
    -e FINANCE_SECRETS_DIR=/run/secrets \
    -e AGENTMAIL_INBOX_ID=team-freedom@agentmail.to \
    -e INVESTMENT_MODEL=gpt-5.6-terra \
    -e INVESTMENT_FALLBACK_MODEL=gpt-5.6-sol \
    -e INVESTMENT_REASONING_EFFORT=medium \
    -e TZ=Europe/Berlin \
    --network finance-hub "${IMAGE}" >/dev/null || return 1
  /usr/bin/docker exec "${CONTAINER}" codex login status || return 1
  /usr/bin/printf '{"state":"UPDATED","from":"%s","to":"%s","checkedAt":"%s"}\n' \
    "${CURRENT_VERSION}" "${LATEST_VERSION}" "$(/bin/date -u +%FT%TZ)" >"${STATUS}"

  mapfile -t OLD_IDS < <(/usr/bin/docker images "${REPOSITORY}" --format '{{.ID}} {{.CreatedAt}}' \
    | /usr/bin/sort -rk2,3 | /usr/bin/awk '!seen[$1]++ {print $1}' | /usr/bin/tail -n +4)
  for image_id in "${OLD_IDS[@]}"; do
    /usr/bin/docker image rm "${image_id}" >/dev/null 2>&1 || true
  done
  echo "$(/bin/date -u +%FT%TZ) promoted ${IMAGE}"
}

if ! run_update >>"${LOG}" 2>&1; then
  /usr/bin/printf '{"state":"FAILED","from":"%s","candidate":"%s","checkedAt":"%s"}\n' \
    "${CURRENT_VERSION}" "${LATEST_VERSION}" "$(/bin/date -u +%FT%TZ)" >"${STATUS}"
  exit 1
fi
