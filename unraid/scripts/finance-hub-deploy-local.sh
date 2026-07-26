#!/bin/bash
#arrayStarted=true
set -euo pipefail

SECRET_ROOT=/mnt/user/appdata/finance-hub/secrets

for name in ActualServer Ghostfolio Ghostfolio-Postgres Ghostfolio-Redis FinanceSync; do
  if /usr/bin/docker inspect "${name}" >/dev/null 2>&1; then
    echo "Container ${name} existiert bereits; Abbruch ohne Änderung." >&2
    exit 1
  fi
done

if ! /usr/bin/docker network inspect finance-hub >/dev/null 2>&1; then
  /usr/bin/docker network create finance-hub >/dev/null
fi

/usr/bin/docker pull postgres:15-alpine
/usr/bin/docker pull redis:alpine
/usr/bin/docker pull actualbudget/actual-server:latest
/usr/bin/docker pull ghostfolio/ghostfolio:latest

/usr/bin/docker create \
  --name Ghostfolio-Postgres \
  --network finance-hub \
  --restart unless-stopped \
  --health-cmd "pg_isready -U ghostfolio -d ghostfolio" \
  --health-interval 10s --health-timeout 5s --health-retries 5 \
  --label net.unraid.docker.managed=dockerman \
  --label net.unraid.docker.icon=https://raw.githubusercontent.com/docker-library/docs/master/postgres/logo.png \
  -v /mnt/user/appdata/finance-hub/ghostfolio-postgres:/var/lib/postgresql/data \
  -v "${SECRET_ROOT}/ghostfolio-postgres-password:/run/secrets/postgres-password:ro" \
  -e POSTGRES_DB=ghostfolio \
  -e POSTGRES_USER=ghostfolio \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/postgres-password \
  postgres:15-alpine

/usr/bin/docker create \
  --name Ghostfolio-Redis \
  --network finance-hub \
  --restart unless-stopped \
  --health-cmd 'redis-cli -a "$(cat /run/secrets/redis-password)" ping' \
  --health-interval 10s --health-timeout 5s --health-retries 5 \
  --label net.unraid.docker.managed=dockerman \
  --label net.unraid.docker.icon=https://raw.githubusercontent.com/docker-library/docs/master/redis/logo.png \
  -v "${SECRET_ROOT}/redis.conf:/usr/local/etc/redis/redis.conf:ro" \
  -v "${SECRET_ROOT}/ghostfolio-redis-password:/run/secrets/redis-password:ro" \
  redis:alpine redis-server /usr/local/etc/redis/redis.conf

/usr/bin/docker create \
  --name ActualServer \
  --network finance-hub \
  --restart unless-stopped \
  --label net.unraid.docker.managed=dockerman \
  --label 'net.unraid.docker.webui=http://[IP]:[PORT:5006]' \
  --label net.unraid.docker.icon=https://github.com/actualbudget/actual/raw/master/packages/desktop-electron/icons/icon.png \
  -p 127.0.0.1:5006:5006 \
  -v /mnt/user/appdata/finance-hub/actual:/data \
  actualbudget/actual-server:latest

/usr/bin/docker create \
  --name Ghostfolio \
  --network finance-hub \
  --restart unless-stopped \
  --env-file "${SECRET_ROOT}/ghostfolio.env" \
  --label net.unraid.docker.managed=dockerman \
  --label 'net.unraid.docker.webui=http://[IP]:[PORT:3333]' \
  --label net.unraid.docker.icon=https://avatars.githubusercontent.com/u/82473144?s=200 \
  -p 127.0.0.1:3333:3333 \
  ghostfolio/ghostfolio:latest

/usr/bin/docker create \
  --name FinanceSync \
  --network finance-hub \
  --restart unless-stopped \
  --security-opt no-new-privileges:true \
  --label net.unraid.docker.managed=dockerman \
  --label 'net.unraid.docker.webui=http://[IP]:[PORT:8080]' \
  -p 127.0.0.1:8080:8080 \
  -v /mnt/user/appdata/finance-hub/finance-sync:/app/data \
  -v /mnt/user/finance-archive:/archive \
  -v /mnt/user/finance-inbox:/inbox \
  -v "${SECRET_ROOT}:/run/secrets:ro" \
  -v /mnt/user/backup/finance-hub:/backup:ro \
  -e TZ=Europe/Berlin \
  finance-sync:local

/usr/bin/docker start Ghostfolio-Postgres Ghostfolio-Redis >/dev/null

for container in Ghostfolio-Postgres Ghostfolio-Redis; do
  for _ in $(/usr/bin/seq 1 60); do
    state=$(/usr/bin/docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "${container}")
    [[ "${state}" == "healthy" ]] && break
    [[ "${state}" == "unhealthy" ]] && {
      echo "${container} ist unhealthy." >&2
      exit 1
    }
    /usr/bin/sleep 2
  done
  state=$(/usr/bin/docker inspect --format '{{.State.Health.Status}}' "${container}")
  [[ "${state}" == "healthy" ]] || {
    echo "${container} wurde nicht rechtzeitig healthy." >&2
    exit 1
  }
done

/usr/bin/docker start ActualServer Ghostfolio FinanceSync >/dev/null
