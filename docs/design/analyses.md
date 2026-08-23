# Analysen

## Ziel und Ausbau

Der Bereich `Analysen` begann mit der Ansicht `Ausgabenstruktur`. Sie vergleicht
gemessene Ausgaben zwischen zwei Zeiträumen, zeigt deren Klassifikation und
führt bis zu den beitragenden Positionen zurück. Weitere Analysen wie
`Regelmäßige Ausgaben prüfen` und die daraus abgeleitete `Optimierungsliste`
nutzen dieselbe Route und ergänzen die Hauptnavigation nicht.

Die Ansicht bewertet Ausgaben nicht und formuliert keine Empfehlungen. Sie
stellt ausschließlich Beträge, Veränderungen, Klassifikationen und bekannte
Datenlücken dar.

## Regelmäßige Ausgaben prüfen

Die Ansicht erkennt nur aktuelle, ausreichend stabile monatliche,
vierteljährliche und jährliche Zahlungsfolgen aus den bereinigten
Einzelbuchungen. Jeder neue Treffer bleibt bis zu einer ausdrücklichen
Nutzerentscheidung eine `mögliche regelmäßige Zahlung`; deshalb werden
vorher weder Summen noch Einsparpotenziale gebildet.

Harte Ausschlüsse gelten für interne Überträge, Kreditkarten-Sammelposten,
Marktplätze ohne Einzelbeleg, nicht auswertbare oder private Gegenparteien und
unsichere Zuordnungen. Die Detailansicht zeigt neutral die Zahlungsgruppe,
Rhythmus, typische und letzte Zahlung, Spanne, Beobachtungsfenster,
Treffer/Ausnahmen, Markierungsgründe, Beleglage sowie getrennte Rhythmus- und
Klassifikationssicherheit.

Die Nutzerentscheidung ist auf `Grundbedarf`, `Gestaltbar`, `Vermeidbar`,
`Unklar` oder `Kein Kandidat` begrenzt. Sie wird ausschließlich in FinanceSync
gespeichert und ändert weder Actual-Buchungen noch die bestehende
Ausgabenklassifikation. Ein Beleg-Fingerprint verhindert, dass eine alte
Entscheidung nach einer materiell veränderten Zahlungsfolge stillschweigend
weitergilt. Nur bestätigte Einträge der Klassen `Gestaltbar` und `Vermeidbar`
können später separat und sichtbar als `[SCHÄTZUNG]` an ein Entscheidungslabor
übergeben werden.

Filter und der geöffnete Kandidat sind als teilbarer URL-Zustand abgelegt. Die
URL enthält nur pseudonymisierte Kandidatenschlüssel. Lade-, Frische-, Teil-,
Leer- und Fehlerzustände benennen die verfügbare Datenbasis, ohne fehlende
Werte als Null auszugeben.

## Optimierungsliste

Die Optimierungsliste übernimmt ausschließlich nutzerbestätigte Ausgaben der
Klassen `Gestaltbar`, `Vermeidbar` und `Unklar`. `Grundbedarf` und als
`Kein Kandidat` markierte Treffer bleiben ausgeschlossen. Pro Eintrag werden
der Maßnahmenstatus `Prüfen`, `Kündigung / Änderung geplant`,
`Gekündigt / umgesetzt` oder `Bewusst beibehalten`, ein optionales
Wirksamkeitsdatum, eine optionale jährliche Entlastung und eine bewusst vom
Nutzer gesetzte Priorität gespeichert.

Die aus Betrag und Rhythmus abgeleiteten Jahreskosten tragen immer
`[SCHÄTZUNG]`. Eine erwartete Gesamtentlastung wird nur gebildet, wenn für jede
geplante oder umgesetzte Maßnahme eine Entlastung ausdrücklich gespeichert
wurde; offene Werte werden nie als null interpretiert. Die Maßnahmen speichern
keine Händler-, Konto- oder Buchungsbezeichner und werden durch denselben
Beleg-Fingerprint gegen stilles Weiterverwenden nach geänderter Buchungslage
geschützt.

## Informationshierarchie

1. Filter: Ansicht, Zeitraum und Vergleichszeitraum.
2. Abstimmbare Gesamtsumme mit Veränderung und nicht zuordenbarem Anteil.
3. Kategorienvergleich als beschriftetes horizontales Balkendiagramm.
4. Klassifikation in `VERTRAGLICH`, `STRUKTURELL`, `GRUNDBEDARF`,
   `DISPOSITIV` und `UNBEKANNT`.
5. Größte Positionen als Tabelle beziehungsweise mobile Liste mit Drill-down.
6. Datenqualitätswarnungen direkt an der betroffenen Analyse.

## FIRE-Hebel

Das Entscheidungslabor trennt drei Wirkungsarten. Bestätigte laufende
Verträge und Abos wirken als jährliche Entlastung. Dispositive variable
Kategorien können ausschließlich nach Nutzerauswahl um 10, 25 oder 50 Prozent
reduziert werden; ihre Planungsbasis ist der Mittelwert aus der annualisierten
laufenden Jahressicht und dem Vorjahr und trägt `[SCHÄTZUNG]`. Bereits separat
angesetzte laufende Entlastungen werden vor der Kategorienreduktion abgezogen.

Historische Einzelposten sind nur rückblickende Entscheidungshilfen. Ihre
Auswahl bedeutet ausdrücklich, einen vergleichbaren künftigen Posten einmalig
zu vermeiden; vergangene Ausgaben werden nicht rückwirkend als Ersparnis
ausgewiesen und die Wirkung wird nicht jährlich fortgeschrieben. Grundbedarf,
strukturelle Ausgaben, unbekannte Zuordnungen, interne Überträge und
Vermögensbildung bleiben aus diesen beiden zusätzlichen Hebellisten
ausgeschlossen.

Alle drei Hebelarten verwenden dieselbe Leserichtung: Bezeichnung,
Kostenbasis, Maßnahme und angesetzte Wirkung. Die Gruppen sind zunächst
kompakt eingeklappt und weisen Kostenbasis sowie bereits angesetzte Wirkung
in der Kopfzeile aus. Variable Kategorien öffnen auf Wunsch die zugehörigen
Buchungen des laufenden Analysezeitraums oder des Vorjahrs, absteigend nach
Einzelbetrag. In dieser authentifizierten persönlichen Detailansicht werden
echte Gegenparteien angezeigt; technische Actual-IDs, IBANs, Kontonummern und
Geheimnisse bleiben pseudonymisiert oder maskiert. Die Buchungssummen stimmen
centgenau mit der jeweiligen Kategorie überein; weitere Buchungen werden
progressiv eingeblendet.

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
