# Krypto · Herkunft & Steuerstatus

## Zweck

Die Analyse dokumentiert die rekonstruierte Herkunft der aktuellen
Solana-Position. Sie trennt drei Bedeutungen, die nicht miteinander verrechnet
werden dürfen:

1. Bestand und Staking Rewards in SOL.
2. Ökonomische Investmentbasis und Cash-on-Cash-Sicht.
3. Steuerliche Prüfspur je Kalenderjahr.

Die Oberfläche berechnet keine Steuerschuld und bezeichnet negatives
Netto-Fiatkapital niemals als negative steuerliche Anschaffungsbasis.

## Informationshierarchie

1. Ansicht, Prüfumfang und datierter Rekonstruktionsstand.
2. Gesamtbestand, Rewards und Bestand in Stake-Accounts.
3. SOL-Konvertierungsbasis, effektive Basis inklusive Staking und
   Netto-Fiatkapital.
4. Bestandszusammensetzung mit liquiden, delegierten, nicht delegierten und
   reservierten SOL.
5. Steuerliche Prüfspur ab 2023 mit Status, Referenzbetrag, Beleglage und
   verbaler Einordnung.
6. Datenbasis und Belegstatus.

## Datenbedeutung

- Delegation und Stake-Account-Bewegungen sind keine Verkäufe.
- Jede marktwertbasierte Rekonstruktion trägt `[SCHÄTZUNG]`.
- Bestätigte Fiat-Cashflows bleiben von ökonomischen Kursproxies getrennt.
- Der Browser erhält keine Wallet- oder Stake-Account-Adressen.
- Die Steuerzeitleiste zeigt `Prüfung nötig`, `Wahrscheinlich steuerfrei`,
  `Unter Freigrenze` oder `Für Erklärung vormerken`. Sie zeigt keinen
  Steuerbetrag.
- Der Prüfumfang folgt der Nutzerentscheidung und beginnt in dieser Stufe mit
  2023.

## Architektur

Die schreibgeschützte API
`GET /api/dashboard/analyses/crypto-position` liefert den serverseitig
berechneten, datierten Rekonstruktionsstand. Die Werte werden in der privaten
FinanceSync-Konfiguration hinterlegt. Das aktuelle Marktvermögen bleibt eine
Aufgabe der Vermögensansicht und von Ghostfolio.

## Responsive Verhalten

Desktop nutzt die bestehende Analysen-Sprache aus
`analyses-desktop-concept.png`: Filterband, Zusammenfassung, offene Panels und
eine exakte Tabelle. Bei 375 Pixel werden Basis- und Bestandszeilen gestapelt;
die Steuerzeitleiste wechselt in vier beschriftete Jahresabschnitte. Wichtige
Informationen sind nicht von Hover abhängig.

## Abnahmekriterien

- Bestandsteile summieren sich auf den Gesamtbestand.
- Rewards plus gekauft/konvertiert ergeben den Gesamtbestand.
- Konvertierungs- und effektive Basis werden serverseitig berechnet.
- Jede rekonstruierte Marktwertzahl trägt `[SCHÄTZUNG]`.
- Die CSV entspricht dem sichtbaren Rekonstruktionsstand.
- URL-Zustand `analysisView=crypto-origin-tax` ist direkt aufrufbar.
- 1536 × 1024 und 375 × 812 funktionieren ohne horizontalen Seitenüberlauf.
- Keine Wallet-Adresse oder private Kennung erscheint in API oder UI.
