# Unraid-Betrieb

Die XML-Dateien werden nach
`/boot/config/plugins/dockerMan/templates-user/` kopiert. Alle Container werden
als einzelne Unraid-Container erzeugt; Compose ist nicht Teil des produktiven
Betriebs.

`my-FinanceSync.xml` verwendet das öffentliche Image
`ghcr.io/myhacsint/finance-sync:stable`. Releases werden zusätzlich mit einem
festen SemVer-Tag wie `0.1.0` veröffentlicht.

Empfohlene Startreihenfolge:

1. Ghostfolio-Postgres
2. Ghostfolio-Redis
3. ActualServer
4. Ghostfolio
5. FinanceSync

Vor jedem Update wird `finance-hub-pre-update.sh` ausgeführt. PostgreSQL bleibt
auf Major 15; `postgres:15-alpine` liefert nur Updates innerhalb dieses Majors.
