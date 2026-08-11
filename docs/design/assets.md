# Vermögen: Konzept für den ersten Funktionsabschnitt

Der erste Abschnitt des Hauptbereichs `Vermögen` zeigt den aktuellen Bestand
über Liquidität, Depots, Vorsorge und Krypto. Er beantwortet zuerst die
einfachste und belastbarste Frage: Was ist vorhanden, wo liegt es und von
welchem Stichtag stammt der Wert? Actual bleibt das Haushaltsbuch, Ghostfolio
die Anlagensicht und FinanceSync das nachvollziehbare Archiv.

## Umfang

- Gesamtvermögen auf Basis der jeweils letzten verfügbaren bestätigten Werte
- Aufteilung in `Liquidität`, `Depots`, `Vorsorge` und `Krypto`
- zugänglicher gestapelter Balken mit Beträgen und Prozentanteilen statt eines
  schwer vergleichbaren Kreisdiagramms
- Bestandsliste mit nicht sensitiver Zweckbezeichnung, Bereich, Wert, Stichtag
  und Datengrundlage
- Bereichsfilter; die unveränderte Ausgangsansicht zeigt alle Bestände
- direkte Verweise zu Actual für Liquidität und zu Ghostfolio für Anlagen,
  sofern dort die jeweilige Detailansicht vorhanden ist
- sichtbarer Hinweis bei manuell bestätigten oder veralteten Werten
- responsive Darstellung ohne horizontalen Tabellenüberlauf

Nicht Teil dieses Abschnitts sind Rendite, Einstandswerte, realisierte oder
unrealisierte Gewinne, Vermögenshistorie, Prognosen und die Aufschlüsselung bis
auf einzelne Wertpapierpositionen. Diese Inhalte benötigen eigene
abstimmbare Datenverträge und folgen als getrennte Ausbaustufen.

## Finanzielle Bedeutung

- Der Gesamtwert ist die Summe der jeweils letzten verfügbaren Bestände. Jeder
  Teilwert behält seinen eigenen Stichtag; ein gemeinsamer Stichtag wird nicht
  vorgetäuscht.
- Fehlende oder fehlgeschlagene Quellen werden nicht als null bewertet. Ist
  ein für die Summe benötigter Wert unbekannt, erscheint die Gesamtsumme als
  Strich und die weiterhin belastbaren Teilwerte bleiben sichtbar.
- Manuell bestätigte Vorsorgewerte werden als solche gekennzeichnet und nicht
  als live synchronisiert dargestellt.
- Für Solana wird ein Euro-Marktwert nur verwendet, wenn Ghostfolio oder eine
  andere freigegebene Kursquelle einen aktuellen Wert liefert. Lamport- oder
  Tokenbestände allein werden nicht in einen erfundenen Eurobetrag übersetzt.
- Rekonstruierte Einstandswerte und daraus abgeleitete Performance werden in
  diesem Abschnitt bewusst nicht gezeigt. Spätere Schätzwerte müssten sichtbar
  `[SCHÄTZUNG]` tragen.
- Private Kontonummern, Wallet-Adressen und Namen privater Personen werden
  nicht an den Browser geliefert. Sichtbar sind nur freigegebene Zwecklabels.
- Sämtliche Beträge und Bezeichnungen in den Konzeptbildern sind synthetisch.

## Interaktion

Auf dem Desktop filtert die Bereichsliste links die Bestände rechts. Die
Ausgangsansicht `Alle Bereiche` zeigt die vollständige Liste; ein erneuter
Klick auf den aktiven Bereich oder eine explizite Gesamtwahl hebt den Filter
auf. Auf kleinen Bildschirmen ersetzt eine native Bereichsauswahl die linke
Leiste. Bestände erscheinen als kompakte gestapelte Zeilen statt als
zusammengedrückte Tabelle. Filterzustand und ausgewählter Bereich bleiben in
der URL erhalten. Alle Bedienelemente sind mindestens 44 CSS-Pixel groß und
vollständig per Tastatur bedienbar.

## Zustände

- `loading`: ruhige Skeleton-Flächen ohne dekorative Bewegung
- `empty`: noch keine Vermögenswerte vorhanden; Beträge erscheinen als Strich
- `manual`: bestätigter Wert mit konkretem Stichtag und Herkunft
- `stale`: letzter erfolgreicher Wert bleibt sichtbar, aber Alter und betroffene
  Quelle werden direkt am Wert benannt
- `partial`: belastbare Teilwerte bleiben sichtbar; eine unvollständige
  Gesamtsumme erscheint als Strich
- `error`: verständliche Fehlermeldung und erneuter Versuch, ohne alte Werte
  als aktuell auszugeben
- `current`: gemessener oder durch Ghostfolio bewerteter aktueller Bestand

## Abnahmekriterien

- Desktop- und Mobilumsetzung entsprechen den freigegebenen Referenzen und dem
  bestehenden visuellen System des Finance Hub.
- Gesamtwert, Bereichssummen und Bestandszeilen stimmen rechnerisch überein.
- Jeder Wert zeigt Stichtag und Datengrundlage; manuelle und veraltete Werte
  sind ohne Farbe allein unterscheidbar.
- Bereichsfilter funktioniert über Maus, Tastatur und Browser-Vor/Zurück.
- Bei einer fehlenden Quelle wird keine irreführende Null oder Gesamtsumme
  dargestellt.
- Es gibt keinen horizontalen Überlauf bei 375 Pixel Breite.
- Die Seite enthält keine sensitiven Konten-, Wallet- oder Personendaten.
- Actual- und Ghostfolio-Verweise öffnen ausschließlich passende
  Detailansichten; fehlt ein belastbarer Zielpfad, wird kein Scheinlink gezeigt.

## Visuelle Referenzen

- `assets-desktop-concept.png`
- `assets-mobile-concept.png`
- `assets-states-concept.png`

Die exakte schriftliche Spezifikation hat bei möglichen Darstellungs- oder
Schreibfehlern eines generierten Konzeptbildes Vorrang.

## Umsetzungsstand

Der erste Vermögensabschnitt ist in der isolierten Unraid-QA-Instanz umgesetzt.
Liquidität und bestätigte Vorsorgewerte stammen aus den letzten
FinanceSync-Salden. Depot- und Kryptowerte werden über die vorhandenen
FinanceSync-Kontozuordnungen schreibgeschützt aus Ghostfolio bewertet. Die
QA-Datenbank ist eine isolierte Momentaufnahme und alle Abrufquellen bleiben
dort deaktiviert.

Der Abgleich am 11. August 2026 ergab acht Bestände in vier Bereichen. Die
Gesamt- und Bereichssummen stimmten mit der API-Antwort überein. Bei 375 Pixel
Breite gab es keinen horizontalen Überlauf; Bereichsauswahl, mobile
Bestandszeilen und feste Hauptnavigation waren aktiv. Die produktive Instanz
wurde anschließend für die Veröffentlichung mit FinanceSync 0.12.0 freigegeben.
