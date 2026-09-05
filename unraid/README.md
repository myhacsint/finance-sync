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
5. FinanceDocumentWorker
6. FinanceSync

Vor jedem Update wird `finance-hub-pre-update.sh` ausgeführt. PostgreSQL bleibt
auf Major 15; `postgres:15-alpine` liefert nur Updates innerhalb dieses Majors.

## Isolierte Dokumenterkennung (ab 0.49)

`my-FinanceDocumentWorker.xml` wird ebenfalls als eigener Container in Unraid
angelegt und wie FinanceSync über die UI aktualisiert. Beide verwenden dieselbe
Release-Version. Der Worker hat **Netzwerk none**, keine Ports, keine Secrets,
keine Datenbank und keinen Archivzugriff. Root-Dateisystem ist schreibgeschützt;
Capabilities sind entfernt, RAM/PIDs/Prozesslaufzeit/Dateigröße begrenzt.

Einzig `/tmp/finance-hub-parser-work` wird in beide Container als
`/parser-work` eingebunden. Vorab mit Besitzer 10001:10001 und Modus 0700
anlegen; nicht in das Langzeitarchiv oder Appdata-Backup aufnehmen. Es enthält
ausschließlich kurzlebige Uploads und abgeleitete Extraktion. Normalerweise
sofortige Löschung; verwaiste Queue-Ergebnisse nach zwei Minuten und verwaiste
Upload-Verzeichnisse nach einer Stunde. Auf SSD/COW bedeutet Löschung logische
Entfernung, keine Garantie physischer Überschreibung.
Auf Unraid liegt dieser Pfad im flüchtigen RAM-Dateisystem, außerhalb Appdata.
Das aktualisierte Array-Start-/Netzwerkskript legt das private Verzeichnis
nach jedem Neustart wieder an; dieses Skript ebenfalls aktualisieren.

FinanceSync benötigt `FINANCE_PARSER_WORK_DIR=/parser-work`. Fehlt der Worker,
schlägt Dokumentverarbeitung geschlossen fehl; es gibt keinen unsicheren
Fallback im Hauptcontainer. ClamAV bleibt mit eigenen Ressourcenlimits im
Hauptcontainer, um seine Signaturen regulär aktualisieren zu können.

Vor erstem Upgrade: konsistentes SQLite-Backup plus Konfiguration, Secrets und
Ghostfolio-Dump prüfen. Schema 1 führt ausschließlich ein Migrationsledger ein;
Nutzdaten bleiben erhalten. Für Rollback den alten FinanceSync-Container/Image
und die Vor-Upgrade-Sicherung aufbewahren. Den Worker erst nach Stoppen der
neuen FinanceSync-Version entfernen. Keine Quell-Synchronisation nötig.

### Weitere Betriebsänderungen

- Browser tauscht den bestehenden Verwaltungstoken gegen eine HttpOnly-Sitzung
  für acht Stunden. Nach Serverneustart ist erneute Anmeldung erforderlich.
  API-Bearer-Zugriffe bleiben kompatibel. Council-Leseendpunkte bleiben auf
  ausdrücklichen Nutzerwunsch ohne Token innerhalb der bestehenden Netzgrenze.
- Maschinen-CSVs bleiben unverändert; tabellensichere Varianten stehen unter
  `exports/tabellensicher/`. Browser-Analyseexport neutralisiert Formelanfänge.
- Quellpublikation speichert den letzten Zustellstatus und Versuchszähler je
  Quelle. Fehler werden in Health sichtbar, der bestehende erneute Quellabruf
  wiederholt idempotente Zustellschritte. Kein automatisches Replay alter
  Depotstände und keine verteilte Transaktion.
- CI prüft Typen, Fachtests, Browser bei 375/1440 Pixeln, Abhängigkeiten und
  echte PDF/OCR/Scanner-Werkzeuge im isolierten Container. Veröffentlichung
  erfolgt ausschließlich für Versionstags.
