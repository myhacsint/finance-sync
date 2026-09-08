# Finance Hub 0.51: verlässliche Belege und wiederverwendbare Ansichten

## Änderungen

- Monatscheck: CLBD vom Morgen des Stichtags gilt nicht als Tagesabschluss.
  Unbelegte Grenzen bleiben nicht prüfbar. Keine Buchungen/Salden wurden korrigiert.
- Enable Banking: Anfragefenster, beobachtete Buchungsdaten, Beginn/Ende,
  Seitenzahl und Abschluss getrennt im privaten Roharchiv. Erreichtes Seitenlimit
  oder wiederholter Fortsetzungsschlüssel bricht vor dem Teilimport ab.
- Status → Kreditkartenabrechnung: Miles-&-More-PDF bis 12 MiB/12 Seiten;
  identische fail-closed ClamAV/qpdf/isolierte Worker-Grenze wie Sutor.
  Native Erkennung; OCR wird angezeigt, bleibt im sicheren MVP nicht übernehmbar.
  Explizite Plus-Gutschriften werden erkannt. Keine erfundenen Abrechnungszeiträume.
- Vorschau ist temporär. Original, PDF-Seiten und Text werden nach Parsing entfernt;
  Crashreste entfernt der Worker. Bestätigung separat: derived-only USER_CONFIRMED
  Intent im bestehenden SQLite-settings-Store, PENDING vor Actual, APPLIED danach.
  Gleicher Stand/Datum ist idempotent; abweichender Stand am Datum ein Konflikt.
  PENDING: dieselbe PDF erneut hochladen/prüfen, stabile imported IDs wiederverwenden.
- Kein automatischer Betragstreffer-Transfer mehr. Kartenübernahme braucht eine
  bereits beidseitig belegte Verknüpfung oder ausdrückliche Bestätigung des erneut
  geprüften Kandidaten. Bei Mehrdeutigkeit keine PDF-Übernahme, um doppelte Kosten
  zu vermeiden. Legacy-Textimport bleibt vorhanden, warnt ohne Verknüpfung.
- Prüfen → Zahlungswege: read-only Vorschläge für Giro/Karte/PayPal mit Plattform-
  Hinweis, Gegenbetrag und höchstens 10 Tagen Abstand. Keine Zuordnung allein wegen
  Betrag/Datum. Mehrdeutigkeit bleibt sichtbar, Prüfung über bestehenden Actual-Link.
- Ausgaben: bis zu 30 benannte Filteransichten serverseitig. Keine Suchtexte/Tokens,
  keine externen URLs, nur erlaubte Filter. Entfernung separat bestätigen.
- Monatscheck: 60-Sekunden-Cache mit lokaler Datenepoch-Invalidierung, begrenzte
  Größe, unveränderte Zeitstempel. Aktualisieren erzwingt neuen Actual-Lesestand.
  Zahlungsweg-Lesecache ebenfalls 60 Sekunden, kein neuer Quellabruf dadurch.
- Neue Oberflächen als separate Module, keine Framework-/Navigationsmigration.

## Bewusste Grenzen

Ein vollständiger API-Antwortsatz beweist nicht, dass die Bank alle historischen
Buchungen bereitstellt. Historische request-less Rohantworten werden nicht
nachträglich als vollständig etikettiert. Die vorliegenden Karten-PDFs enthalten
keinen ausdrücklichen Abrechnungszeitraum: daher kein grüner Monats-Vollständigkeits-
Nachweis. Vorschläge ersetzen keinen Transferbeleg. Kein automatisches Nachimportieren
historischer Abrechnungen oder Korrigieren persönlicher Buchungen.

Originalarchivierung erfolgt für diesen neuen Flow nicht. Bestätigte strukturierte
Kartendaten in SQLite gehören in die bestehende Finance-Hub-Sicherung. DB-Backup
und Actual-Sicherung sind gemeinsam für Wiederherstellung relevant; ein Code-Rollback
darf die Datenbank nicht auf einen älteren Stand zurücksetzen.

## QA / Design-Fidelity

Synthetische Tests: Saldenzeitpunkt, Abruffenster, Pagination-Grenze, Refunds,
Mehrdeutigkeit, Summen/Datumsfehler, PII-Headerausschluss, Preview-Limits,
explizite Bestätigung, PENDING-Recovery, Wiederholung/Konflikt, allowlisted Views,
Cache-Invalidierung, API-Auth/no-store, Desktop und 375px, keine Payment-Writes.
Reale lokale Karten-PDFs April–August 2026 nur read-only Parsergate, nie bestätigt.

Designreferenz: lokales Konzept finance-workflows-konzept-2026-09-08.png.
Fidelity: bestehender navy Shell; vier Schritte; getrennte Prüfdaten und Warnungen;
separate Bestätigungen; 44px Controls; mobile Umsatzkarten; gespeicherte Ansichten
als eigene kompakte Fläche. Bewusste Abweichung vom Konzept: Datum statt erfundenem
Belegzeitraum und negative Konto-Salden statt positiver Ausgaben-KPI.

Produktion erst nach Tests/CI/Sicherheitsgate und validiertem Backup umschalten.
Council bleibt ohne Token. Alte Leipziger, Newsletter-Worker und andere Dienste
werden nicht geändert. Zwei gestoppte FinanceSync-Rollbackcontainer behalten.
