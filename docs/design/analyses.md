# Analysen – Ausgabenstruktur

## Ziel der ersten Stufe

Der Bereich `Analysen` startet mit genau einer belastbaren Ansicht:
`Ausgabenstruktur`. Sie vergleicht gemessene Ausgaben zwischen zwei Zeiträumen,
zeigt deren Klassifikation und führt bis zu den beitragenden Positionen zurück.
Weitere Analysearten werden später über dieselbe Route ergänzt, ohne die
Hauptnavigation zu erweitern.

Die Ansicht bewertet Ausgaben nicht und formuliert keine Empfehlungen. Sie
stellt ausschließlich Beträge, Veränderungen, Klassifikationen und bekannte
Datenlücken dar.

## Informationshierarchie

1. Filter: Ansicht, Zeitraum und Vergleichszeitraum.
2. Abstimmbare Gesamtsumme mit Veränderung und nicht zuordenbarem Anteil.
3. Kategorienvergleich als beschriftetes horizontales Balkendiagramm.
4. Klassifikation in `VERTRAGLICH`, `STRUKTURELL`, `GRUNDBEDARF`,
   `DISPOSITIV` und `UNBEKANNT`.
5. Größte Positionen als Tabelle beziehungsweise mobile Liste mit Drill-down.
6. Datenqualitätswarnungen direkt an der betroffenen Analyse.

## Datenbedeutung

- Interne Überträge sind keine Ausgaben.
- PayPal-Bankbewegungen sind Transfergegenbuchungen; Amazon ist nur Händler-
  und Belegquelle. Beide dürfen keine zusätzlichen Ausgaben erzeugen.
- Firmenwagenkosten stammen aus dem Gehaltsartefakt und werden als gesonderte
  gemessene Position ergänzt.
- Historische Kreditkarteneinzelbewegungen fehlen bis Februar 2026. Die
  Sammelabbuchungen bleiben `UNBEKANNT` und werden nicht fingiert aufgeteilt.
- Vollständige Kalenderjahre werden gemessen dargestellt, sofern keine
  einzelne Zusatzposition ausdrücklich `[SCHÄTZUNG]` ist. Ein laufendes Jahr
  wird als Zeitraum bis zum letzten vollständigen Datenmonat mit demselben
  Ausschnitt des Vergleichsjahres verglichen.
- Eine Annualisierung ist eine optionale spätere Sicht und trägt bei jeder
  Zahl sichtbar den Marker `[SCHÄTZUNG]`.
- Fehlende Teilwerte ergeben keine Null. Dann bleiben betroffene Summen offen
  und die fehlende Datenbasis wird benannt.

Die Zahlen in den Konzeptbildern zeigen den gemessenen, nach dem PayPal- und
Amazon-Abgleich korrigierten Stand für 2025 und 2024. In der Umsetzung liefert
eine schreibgeschützte FinanceSync-API die jeweils gewählten Zeiträume.

## Interaktion

- Route und Filter bleiben als teilbarer URL-Zustand erhalten, ohne private
  Bezeichner in der URL.
- `Anwenden` aktualisiert alle Bereiche gemeinsam.
- `Exportieren` gibt genau den sichtbaren Zeitraum, Vergleich und die sichtbare
  Klassifikation als CSV aus.
- Positionen öffnen eine Monatsaufschlüsselung direkt in der Analyse.
  Buchungsänderungen bleiben Actual vorbehalten.
- Diagrammwerte sind immer direkt beschriftet und zusätzlich tabellarisch
  erreichbar; Hover ist nicht erforderlich.

## Zustände

Die Ansicht unterscheidet Laden, teilweise verfügbare Daten, explizite
Hochrechnung, faktisch leere Filter und Fehler. Fehlende Werte erscheinen als
Gedankenstrich statt als `0 €`. Fehler bieten eine erneute Abfrage an.

## Abnahmekriterien für die QA-Stufe

- Gesamtsumme, Kategorien, Klassen und Positionen stimmen mit derselben
  API-Antwort überein.
- Die fünf Klassen summieren sich centgenau zur wirtschaftlichen Gesamtausgabe.
- Wiederholte PayPal-, Amazon- und Bankbelege werden nicht doppelt gezählt.
- Zeit- und Vergleichsfilter funktionieren gemeinsam und bleiben in der URL.
- CSV-Export entspricht den sichtbaren Filtern und Summen.
- Jede Schätzung trägt exakt `[SCHÄTZUNG]`; die Standardsicht enthält keine
  Hochrechnung.
- Desktop bei 1536 × 1024 und Mobilansicht ab 375 Pixel funktionieren ohne
  horizontalen Seitenüberlauf.
- Filter, Export, Balken, Listen und Drill-downs sind per Tastatur bedienbar;
  Touch-Ziele sind mindestens 44 × 44 Pixel groß.
- Lade-, Teil-, Leer- und Fehlerzustände ersetzen fehlende Daten nie durch Null.
- Browserantworten enthalten keine Kontonummern, Wallet-Adressen, Tokens oder
  Klarnamen von Privatpersonen.

## Konzeptartefakte

- `analyses-desktop-concept.png`: vollständige Desktopansicht.
- `analyses-mobile-concept.png`: vollständige mobile Fortsetzung.
- `analyses-states-concept.png`: Laden, Teilzustand, Hochrechnung und leerer
  Filter.

## Umsetzungsstand

Die erste funktionsfähige Stufe wurde in einer isolierten Unraid-QA-Instanz
umgesetzt und am 11. August 2026 abgenommen. Gesamtsumme, Kategorien,
Klassifikation und größte Positionen stammen aus derselben schreibgeschützten
Actual-Auswertung; lokale Zusatzwerte und Korrekturen bleiben außerhalb des
Images in der produktiven Konfiguration. Die Freigabe gilt für FinanceSync
`0.13.0`.
