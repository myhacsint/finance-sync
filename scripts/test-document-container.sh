#!/usr/bin/env bash
set -euo pipefail
image="${1:?Pass the locally built FinanceSync image}"
worker="finance-document-gate-worker-$$"
client="finance-document-gate-client-$$"
volume="finance-document-gate-$$"
cleanup() {
  docker rm -f "$worker" "$client" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker volume create "$volume" >/dev/null
docker run --rm --network none --user 0 --entrypoint sh -v "$volume:/parser-work" "$image" -c 'chown 10001:10001 /parser-work; chmod 700 /parser-work'
docker run -d --name "$worker" --network none --read-only --cap-drop ALL --security-opt no-new-privileges:true --memory 768m --pids-limit 64 --tmpfs /tmp:rw,noexec,nosuid,size=256m -e FINANCE_MODE=parser-worker -e FINANCE_PARSER_WORK_DIR=/parser-work -v "$volume:/parser-work" "$image" >/dev/null
for ((i=0;i<30;i++)); do
  if docker exec "$worker" python3 /app/python/parser_worker.py --health; then break; fi
  sleep 1
done
docker exec "$worker" python3 /app/python/parser_worker.py --health
docker exec "$worker" python3 -c 'import socket; s=socket.socket(); s.settimeout(2)
try:
 s.connect(("1.1.1.1",443)); raise SystemExit("network unexpectedly reachable")
except OSError:
 print("PASS: no external network")
'
docker run --rm --name "$client" --network none --cap-drop ALL --security-opt no-new-privileges:true --memory 2g --pids-limit 128 --entrypoint node -e FINANCE_PARSER_WORK_DIR=/parser-work -v "$volume:/parser-work" -v "$PWD/scripts/test-document-worker.mjs:/app/scripts/test-document-worker.mjs:ro" "$image" /app/scripts/test-document-worker.mjs
