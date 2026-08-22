# Entscheidungslabor

Freigegebene Richtung für die erste Version der 20-Jahres-Projektion.

## Zweck

Das Entscheidungslabor vergleicht das vorhandene Finanzvermögen ohne Immobilie mit einem veränderten Szenario. Einbezogen werden Liquidität, Depots, Vorsorge, Krypto und physisches Gold. Jede Projektion ist als `[SCHÄTZUNG]` gekennzeichnet.

## Bedienung

- Realrendite nach Inflation, konservativ mit 2 % vorbelegt
- Ausgangsbasis `Aktuelles Jahr` als Standard: tatsächliche YTD-Bilanz plus realer Referenzmonat nahe dem Median der Monatsüberschüsse
- geglättete Basis `YTD + letztes Jahr`
- monatliche Veränderung für zusätzliche Einsparungen oder Ausgaben
- einmaliger Zu- oder Abfluss für Vorhaben wie eine Renovierung
- teilbarer Zustand über abstrakte URL-Parameter

## Ergebnis

- durchgezogene Basislinie und gestrichelte Szenariolinie über 20 Jahre
- Einnahmen, Ausgaben, tatsächliche Periodenbilanz, typische Monatswerte und annualisierter Überschuss der gewählten Basis
- letzter vollständiger Monat sowie aktueller Monat bis heute als Vergleich zum typischen Monat; beide verändern die Projektion nicht
- getrennte Aufschlüsselung von Arbeitseinkommen, sonstigen und zweckgebundenen Einnahmen, Kapitalerträgen und Vermögensbildung
- Mitarbeiteraktienvorteile bleiben ausdrücklich nicht verfügbar, solange sie nicht als eigener Arbeitgeberzufluss gebucht sind
- exakte Vergleichswerte nach 1, 5, 10 und 20 Jahren
- sichtbare Differenz zur Basis
- Warnung, falls das Finanzvermögen in einem Szenario aufgebraucht wird
- Datenstand, Quellen und Berechnungsgrundlagen ohne personenbezogene Buchungsdaten

## Darstellung und Zustände

Die Ansicht übernimmt Navigation, Typografie, Farben, Abstände und Karten des bestehenden Finance Hub. Desktop zeigt Annahmen und Verlauf nebeneinander; mobil werden sie untereinander angeordnet. Linien unterscheiden sich zusätzlich durch Strichart, Werte sind nicht nur über Farbe lesbar. Bei fehlender Vermögens- oder Sparratenbasis wird keine Zahl erfunden; Teil- und Fehlerzustände bleiben explizit.

## Abnahmekriterien

- Standardannahmen erzeugen identische Basis- und Szenariowerte.
- Einmalbetrag wirkt ab Start, monatliche Änderung ab dem ersten Monat.
- Kapitalerträge, Erstattungen und interne Überträge fließen nicht als laufendes Einkommen ein.
- Der aktuelle unvollständige Monat fließt nicht in Median oder Projektion ein.
- Finanzvermögen wird nach Aufbrauch bei null begrenzt, nicht automatisch als Schuld fortgeschrieben.
- Desktop und 375-Pixel-Mobilansicht funktionieren ohne horizontales Überlaufen.
- Bedienfelder sind beschriftet und per Tastatur nutzbar.
