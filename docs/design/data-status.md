# Datenstatus: freigegebener erster UI-Bereich

Der Datenstatus ist die erste lokal umgesetzte Oberfläche des Finance Hub. Er
zeigt keine Vermögenswerte und keine personenbezogenen Kontodetails, sondern
ausschließlich Aktualität, offene Aufgaben, historische Importe und den
technischen Systemzustand.

## Gestaltungsregeln

- dunkle, ruhige Arbeitsoberfläche ohne Marketingelemente oder Farbverläufe
- Aufgaben vor automatischen Quellen, damit notwendige Eingaben sichtbar sind
- Status immer mit Text, Symbol und Farbe; Farbe allein transportiert keine Bedeutung
- einzeilige Quellenliste statt gleichförmigem Kartenraster
- fünf beschriftete Hauptziele in der mobilen Navigation
- mindestens 44 Pixel große primäre Interaktionsflächen
- keine IBANs, Kontonummern oder Eigentümernamen in der Dashboard-Antwort
- manuelle Importe bleiben zweistufig: Vorschau, explizite Bestätigung

Die visuellen Referenzen liegen in `data-status-desktop.png` und
`data-status-mobile.png`. Die im lokalen Browser geprüften Umsetzungen liegen
in `data-status-implemented-desktop.png` und
`data-status-implemented-mobile.png`.
