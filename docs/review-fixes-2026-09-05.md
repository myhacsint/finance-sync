# Finance Hub Review-Korrekturen – 5. September 2026

## Stand

Umsetzung im Branch `codex/finance-review-fixes-20260905`, vorbereitete Version
0.49.0. **Noch nicht veröffentlicht oder produktiv ausgerollt.**
Ausgangsbaum 8fcd2ec entspricht dem produktiven Quellstand 0.48.3.
Produktion am Ende der Prüfung: 0.48.3, healthy, keine Neustarts.

Autorenidentität: Der Nutzer hat ausdrücklich die Fortführung wie bisher
bestätigt. Die vorhandene Git-Identität wird unverändert verwendet; es werden
keine zusätzlichen Co-Autoren, DCO-Erklärungen oder Signaturen behauptet.

## Umgesetzte Review-Punkte

| Punkt | Lokale Änderung |
|---|---|
| R01 | Übersicht und Detail verwenden denselben Actual-Buchungsleser, einschließlich unkategorisierter Ausgaben, Erstattungen und Transferausschluss. Laufender Zeitraum endet heute. |
| R02 | Monatsvergleich und Brücke übernehmen den historischen API-Stichtag; keine Mischung einzelner alter Vorsorgebelege. Historische Liquidität wird auf die gleichen zugeordneten Bankkonten wie die Vermögensansicht beschränkt. Aktueller Verlaufspunkt serverseitig statt Browser-Überschreibung; fehlende Zuordnung bleibt offen. |
| R03 | Upload-Abbruch, vorzeitiges Verbindungsende und Timeout beenden den Stream und räumen temporäre Dateien auf. |
| R04 | PDF-/OCR-Werkzeuge laufen über privaten Dateiaustausch in einem netzlosen, unprivilegierten, ressourcenbegrenzten Dokument-Worker ohne Secrets-/DB-/Archivmounts. Fail-closed bei Ausfall. Eigenes Unraid-Template, Heartbeat und Aufräumen. |
| R05 | OCR-Entscheidung pro Seite, native Seiten bleiben erhalten; stabile Renderdateinamen auch bei zehn bis zwölf Seiten. |
| R06 | Zugängliche Charttabellen in begrenzten Screenreader-Containern; kein mobiler Seitenoverflow im befüllten Test. |
| R07 | Stabile mobile Hauptnavigation; Prüfen, Analysen und Status über zugängliches Mehr-Menü. |
| R08 | Gemeinsame Sutor-PDF-Freshness-Prüfung für Übersicht und Status; Vorsorgedatum bleibt unabhängig von offenen Aufgaben sichtbar. |
| R09 | Abbruch/Generation für Ansichtsabrufe; alte Antworten und Fehler überschreiben keine neue Route. Optionaler Historienfehler verwirft nicht die Übersicht. |
| R10 | **Ausdrückliche Ausnahme: Council bleibt ohne Token.** Keine Änderung der Netzgrenze. |
| R11 | Delegierte Bedienaktionen ohne eval/Inline-JavaScript, strikte Skript-CSP. Achtstündige HttpOnly-Sitzung, SameSite/Origin-Prüfung. Token wird aus Browserstorage entfernt; freie Suchtexte nicht mehr in URL/History. |
| R12 | Originalgetreue Maschinen-CSVs plus tabellensichere Varianten; Browser-CSV schützt Textzellen und verwendet echte Zeilenumbrüche. |
| R13 | Atomare lokale Bundle-Importe mit verschachtelbaren Savepoints. Persistenter Zustellstatus je Quelle, Zielstufen und Versuchszähler; Fehler sichtbar, erneuter Quellabruf nutzt bestehende Idempotenz. |
| R14 | CI für main/PR plus Typen/Fachtests, echte Browser- und Containerintegration; Veröffentlichung nur auf Tags. Paketschreibrecht nur für Release-Job. |
| R15 | Versionierte transaktionale Migrationen, kleine getrennte Module für Sitzungen, Aktionen, Historienabgleich, Worker, Zustellstatus und Freshness; bereinigte Request-Korrelation; Inhalts-Hashes für Assets; Testartefakte ignoriert; Touch-Ziele vergrößert. |

## Prüfung

- 188 TypeScript-/Node-Tests, 6 Python-Tests bestanden.
- 10 Browserprüfungen bei 1440 und 375 Pixeln: leere Sutor-Seite, stabile
  Navigation, CSP/Sitzung, Origin-Schutz, Council-Ausnahme, verspätete Antworten,
  befüllte Charts ohne Overflow und delegierte Zeit-/Refresh-Bedienung.
- Synthetische Desktop-/Mobile-Screenshots visuell geprüft.
- npm audit: 0 bekannte Schwachstellen.
- Tatsächliche Containerprüfung auf Unraid: zwölfseitiges natives/Scan-Misch-PDF,
  OCR der letzten Seite, aktive Inhalte abgewiesen, Seitenlimit, erlaubtes
  leeres Nutzerpasswort, echtes Passwort abgewiesen, Befehls-Allowlist,
  Virenscanner-Testdetektion und temporäres Aufräumen bestanden.
- Netzwerk-none aktiv durch Verbindungsversuch nachgewiesen. Worker hat nur
  Arbeitsmount, schreibgeschütztes Root-Dateisystem, keine Capabilities,
  no-new-privileges, 768 MiB Speichergrenze und 64 PIDs.
- Keine echten Dokumente hochgeladen, keine Bestätigung, kein Quell-Sync,
  keine Nutzerdaten verändert. Testcontainer/temporäre Testdateien entfernt.
- CI-Konfiguration vorbereitet, aber mangels Veröffentlichung noch kein
  GitHub-CI-Lauf für diesen Branch.

## Grenzen und noch notwendige Release-Schritte

- Kein pauschaler Sicherheits-/WCAG-Nachweis. Inline-Styles bleiben für die
  bestehenden dynamischen Diagramme erlaubt; Inline-Skripte sind verboten.
- ClamAV bleibt mit separaten Ressourcenlimits im Hauptcontainer; seine
  Signaturen werden dort aktualisiert. PDF/OCR-Werkzeuge sind separat isoliert.
- RAM-basierter Unraid-Arbeitsordner `/tmp/finance-hub-parser-work` muss vor
  Start mit UID/GID 10001 und 0700 erstellt werden. Aktualisiertes Array-Start-
  Skript und beide Templates installieren. Nicht in Backups übernehmen.
- Kein generischer Outbox-Replay alter Depotstände: Retry bleibt der vorhandene
  Quellworkflow. Das Zustelljournal ergänzt die bestehenden Sync-Läufe; keine
  verteilte Transaktion mit Actual/Ghostfolio.
- Die größeren Ansichtsdateien sind bewusst nicht vollständig neu geschrieben.
  Relevante Verantwortlichkeiten wurden extrahiert, ohne Frameworkwechsel.
- Nach geklärter Autorenidentität: ausgehende Attribution prüfen, vollständige
  Gates erneut bestätigen, konsistentes Vor-Upgrade-Backup samt SQLite-Integrity,
  Ghostfolio-Dump, Konfiguration/Secrets/Templates und Manifest verifizieren.
- Erst dann Commit/CI/Release und abgesicherter Austausch mit altem Container als
  Rollback. Worker und FinanceSync auf dieselbe Version setzen.
- Produktiv noch zu prüfen: API-Cent-Parität, historische Vergleichsbasis,
  Sutor-Aufgaben, Desktop/Mobile, Session/Secure-Cookie, Council ohne Token,
  synthetische Upload-Vorschau ohne Confirm sowie keine zurückgelassenen Daten.
  Diese Live-Abnahme wird ausdrücklich nicht als bereits erledigt behauptet.

Angewendete UI-Regeln: Finance-Hub-Produktregeln und
[Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
