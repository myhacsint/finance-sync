# Ausgaben: Konzept für den ersten Funktionsabschnitt

Der erste Abschnitt des Hauptbereichs `Ausgaben` macht einen vollständigen
Kalendermonat nach Kategorien sichtbar und führt von jeder Kategoriesumme zu
den zugehörigen Buchungen. Er erweitert die Ausgabenkarte der Übersicht, ohne
Actual als Ort für Kategorienpflege oder Buchungsänderungen zu ersetzen.

## Umfang

- unabhängige Monatsnavigation; Standard ist der letzte vollständig
  abgeschlossene Monat
- Monatsgesamtausgabe, Zahl der Buchungen und kategorisierter Anteil
- Kategorien absteigend nach Betrag, jeweils mit Wert und relativem Balken
- Auswahl einer Kategorie filtert die Buchungsliste
- Suche über Händler beziehungsweise Buchungstext
- Kontenfilter mit nicht sensitiven Zweckbezeichnungen
- paginierte Buchungsliste; Desktop als Tabelle, Mobilgerät als gestapelte
  Buchungszeilen
- Monat, Kategorie, Suche, Konto und Seite bleiben in der URL erhalten
- direkte Nachvollziehbarkeit: Kategoriesumme und gefilterte Buchungen müssen
  rechnerisch übereinstimmen

Nicht Teil dieses Abschnitts sind Kategorienbearbeitung, Regeln,
Händler-Normalisierung, wiederkehrende Kosten, Zeitreihen, Jahresvergleiche,
Zahlungswege und Exporte. Diese folgen als getrennt abnehmbare Ausbaustufen.

## Finanzielle Bedeutung

- Interne Überträge, Kreditkarten- und PayPal-Ausgleichsbuchungen sowie andere
  erkannte Transfergegenstücke zählen nicht als Ausgabe.
- Amazon- und PayPal-Daten dürfen Buchungen nur anreichern und keine zweite
  Ausgabe erzeugen.
- Fehlende Daten werden nicht als null dargestellt.
- Rekonstruierte oder hochgerechnete Werte tragen immer sichtbar
  `[SCHÄTZUNG]`; für diesen ersten Abschnitt sind keine Schätzwerte vorgesehen.
- Private Kontodaten, IBANs und Namen privater Gegenparteien werden nicht an den
  Browser geliefert. Konten erscheinen nur mit freigegebenen Zwecklabels.
- Die in den Konzeptbildern gezeigten Händler und Beträge sind synthetisch und
  nicht Teil des späteren Datenvertrags.

## Interaktion

Auf dem Desktop bildet die Kategorienliste links den Master und die
Buchungstabelle rechts den Detailbereich. Auf kleinen Bildschirmen stehen beide
Bereiche untereinander; die Buchungen werden als kompakte Zeilen statt als
horizontal überlaufende Tabelle gezeigt. Eine ausgewählte Kategorie ist durch
Text, Markierung und Farbe erkennbar. Alle Bedienelemente sind mindestens 44
CSS-Pixel groß und vollständig per Tastatur bedienbar.

## Zustände

- `loading`: ruhige Skeleton-Flächen ohne dekorative Bewegung
- `empty`: keine Buchungen für den gewählten Monat; Werte werden als Strich,
  nicht als null gezeigt
- `partial`: fehlende Quelle wird direkt über den betroffenen Werten benannt
- `error`: verständliche Fehlermeldung und erneuter Versuch
- `current`: gemessene, vollständig abstimmbare Monatsdaten

## Abnahmekriterien

- Desktop- und Mobilumsetzung entsprechen den freigegebenen Referenzen.
- Der letzte vollständige Monat ist voreingestellt; Vor/Zurück und direkte
  Monatswahl funktionieren.
- Auswahl, Suche, Kontenfilter und Pagination funktionieren gemeinsam und über
  Browser-Vor/Zurück.
- Kategoriesummen, Monatsgesamtbetrag und Buchungslisten stimmen mit der
  Serverantwort überein.
- Interne Transfers und angereicherte Amazon-/PayPal-Details erzeugen keine
  Doppelzählung.
- Es gibt keinen horizontalen Überlauf bei 375 Pixel Breite.
- Lade-, Leer-, Teil- und Fehlerzustand sind mit Tastatur und Screenreader
  verständlich.
- Die Seite enthält keine sensitiven Konten- oder Personendaten.

## Visuelle Referenzen

- `spending-desktop-concept.png`
- `spending-mobile-concept.png`
- `spending-states-concept.png`

## Umsetzungsstand

Der Bereich ist mit FinanceSync `0.11.0` umgesetzt und nach der Abnahme am
11. August 2026 für die produktive Unraid-Instanz freigegeben. Die
Serverantwort wird aus Actual erzeugt und fünf Minuten zwischengespeichert.
Transfers, Startsalden, Einnahmenkategorien und Off-Budget-Konten werden
ausgeschlossen; Erstattungen mindern die jeweilige Ausgabenkategorie.
Konten- und Kategorie-IDs werden vor der Browserausgabe gehasht, sichtbare
Kontonummern entfernt und erkennbare private Gegenparteien neutralisiert.

Der Abgleich mit den lokalen Actual-Daten wurde am 11. August 2026 erfolgreich
durchgeführt. Screenshots mit echten Händlern, Beträgen oder Kontobezeichnungen
werden nicht als Repository-Artefakte gespeichert.

Die exakte schriftliche Spezifikation hat bei möglichen Darstellungs- oder
Schreibfehlern eines generierten Konzeptbildes Vorrang.
