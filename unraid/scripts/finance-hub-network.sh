#!/bin/bash
set -euo pipefail

if ! /usr/bin/docker network inspect finance-hub >/dev/null 2>&1; then
  /usr/bin/docker network create finance-hub
fi

if /usr/bin/docker inspect UptimeKuma >/dev/null 2>&1; then
  if ! /usr/bin/docker inspect UptimeKuma \
    --format '{{json .NetworkSettings.Networks}}' | /bin/grep -q '"finance-hub"'; then
    /usr/bin/docker network connect finance-hub UptimeKuma
  fi
fi
