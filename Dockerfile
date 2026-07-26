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
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 finance \
    && useradd --uid 10001 --gid finance --home-dir /app --no-create-home finance \
    && mkdir -p /app/data /archive /inbox /run/secrets \
    && chown -R finance:finance /app /archive /inbox
COPY --from=build --chown=finance:finance /build/package.json /app/package.json
COPY --from=build --chown=finance:finance /build/node_modules /app/node_modules
COPY --from=build --chown=finance:finance /build/dist /app/dist
USER finance
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--experimental-sqlite", "dist/server.js"]
