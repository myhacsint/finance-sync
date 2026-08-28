FROM node:22-bookworm-slim AS build
WORKDIR /build
COPY package.json package-lock.json* tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
LABEL org.opencontainers.image.title="FinanceSync" \
      org.opencontainers.image.description="Self-hosted finance ingestion and archive service" \
      org.opencontainers.image.source="https://github.com/myhacsint/finance-sync"
ENV NODE_ENV=production \
    FINANCE_DATA_DIR=/app/data \
    FINANCE_ARCHIVE_DIR=/archive \
    FINANCE_INBOX_DIR=/inbox \
    FINANCE_SECRETS_DIR=/run/secrets \
    FINANCE_BACKUP_DIR=/backup \
    PORT=8080 \
    TZ=Europe/Berlin
WORKDIR /app
COPY python/requirements-fints.txt /tmp/requirements-fints.txt
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates clamav clamav-freshclam curl imagemagick poppler-utils python3 python3-pip qpdf tesseract-ocr tesseract-ocr-deu tini util-linux \
    && freshclam --quiet \
    && pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements-fints.txt \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 finance \
    && useradd --uid 10001 --gid finance --home-dir /app --no-create-home finance \
    && sed -i 's/^DatabaseOwner .*/DatabaseOwner finance/' /etc/clamav/freshclam.conf \
    && mkdir -p /app/data /archive /inbox /run/secrets /var/lib/clamav \
    && chown -R finance:finance /app /archive /inbox /var/lib/clamav
COPY --from=build --chown=finance:finance /build/package.json /app/package.json
COPY --from=build --chown=finance:finance /build/node_modules /app/node_modules
COPY --from=build --chown=finance:finance /build/dist /app/dist
COPY --chown=finance:finance assets /app/assets
COPY --chown=finance:finance python /app/python
COPY --chown=finance:finance docker/finance-entrypoint.sh /app/finance-entrypoint.sh
USER finance
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/finance-entrypoint.sh"]
