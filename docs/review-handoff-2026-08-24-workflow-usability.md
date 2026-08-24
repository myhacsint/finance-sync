# Review-Handoff: Finance Hub Workflow, Redundanzen und Alltagsnutzung

**Stand:** 24.08.2026  
**Geprüfte Version:** FinanceSync 0.42.2  
**Zweck:** Kritische Zweitmeinung vor jeder Umsetzung  
**Status:** Nur Review-Vorschlag. Aus den nachfolgenden Punkten ist noch keine Änderung freigegeben oder implementiert.

## Review-Auftrag an Grok

Bitte die vorgeschlagene Informationsarchitektur und Priorisierung kritisch prüfen. Nicht automatisch bestätigen und nicht direkt implementieren.

Insbesondere beantworten:

1. Welche heute vorhandenen Redundanzen sind im Alltag nützlich und sollten bleiben?
2. Welche Wiederholungen erzeugen widersprüchliche Aussagen, unnötige Pflege oder Orientierungslosigkeit?
3. Ist die vorgeschlagene Trennung zwischen Übersicht, Ausgaben, Vermögen, Prüfen, Planen, Analysen und Status fachlich sinnvoll?
4. Welche Informationen fehlen im vorgeschlagenen täglichen Einstieg?
5. Welche Punkte sind zu groß, zu riskant oder falsch priorisiert?
6. Welche einfachere Alternative würde denselben Nutzwert erreichen?
7. Gibt es technische Abhängigkeiten oder Datenrisiken, die vor einer UI-Änderung gelöst werden müssen?

Erwartetes Review-Ergebnis:

- `Zustimmung`, `Anpassen` oder `Ablehnen` je Maßnahme;
- kurze Begründung;
- korrigierte Priorität;
- zusätzliche Vorschläge, falls sie den Alltagsworkflow konkret verbessern;
- ausdrückliche Kennzeichnung von Annahmen und noch zu prüfenden Behauptungen.

## Zielbild des Nutzers

Der Finance Hub soll im Alltag schnell vier Aufgaben erfüllen:

1. den aktuellen Finanzstand und relevante Veränderungen erkennen;
2. Abweichungen, Datenlücken und Handlungsbedarf priorisieren;
3. bei Bedarf bis auf Kategorie, Händler, Buchung oder Vermögensposition heruntergehen;
4. die Wirkung konkreter Einnahmen- und Ausgabenhebel auf Jahrespfad und FIRE-Ziel verstehen.

Redundanz ist nicht grundsätzlich unerwünscht. Eine Kennzahl darf an mehreren Stellen erscheinen, wenn jede Stelle eine andere Aufgabe erfüllt und dieselbe Datenbasis verwendet. Problematisch sind Wiederholungen ohne klaren Zweck, unterschiedliche Werte für dieselbe Aussage oder mehrere Orte zur Pflege derselben Entscheidung.

## Geprüfter Umfang

Geprüft wurden die aktuelle Navigation und die Aufgabenverteilung zwischen:

- Übersicht;
- Ausgaben;
- Vermögen;
- Prüfen;
- Planen mit FIRE-Kurs, Jahresausblick und 20-Jahres-Trajektorie;
- Analysen;
- Status;
- den Direktlinks zu Actual Budget und Ghostfolio.

Der Review erfolgte lesend gegen eine isolierte Kopie der produktiven Daten mit dem exakten 0.42.2-Container. Die Produktionsdaten wurden dabei nicht verändert.

## Bestätigte Beobachtungen

### 1. Die Übersicht erfüllt zu viele Aufgaben gleichzeitig

Sie zeigt derzeit unter anderem:

- Gesamtvermögen und Veränderung;
- Vermögensbrücke;
- vollständigen Monatsvergleich nach Vermögensbereich;
- mehrmonatigen Geldfluss;
- Vermögensaufteilung;
- Ausgabenkategorien;
- Datenbasis und Quellenfrische;
- einzelne manuelle Aufgaben.

Damit ist sie gleichzeitig Tagescockpit, Vermögensanalyse, Ausgabenübersicht und verkürzter Datenstatus. Die Informationen sind einzeln nützlich, konkurrieren aber um Aufmerksamkeit.

### 2. Vermögenssummen sind nicht zwingend innerhalb einer Sitzung identisch

Im isolierten Review zeigte die Übersicht **199.644 EUR**, die Vermögensseite rund zehn Sekunden später **199.630 EUR**. Gleichzeitig veränderte sich der ausgewiesene Kryptoanteil.

**Bestätigt:** Zwei Ansichten konnten in derselben Sitzung unterschiedliche Gesamtwerte zeigen.  
**Naheliegende Erklärung, noch technisch zu verifizieren:** Die Ansichten bewerten einen volatilen Marktwert separat und verwenden keinen gemeinsamen Snapshot.  
**Nicht behauptet:** Es gibt keinen Hinweis auf Datenverlust oder eine Differenz durch Doppelzählung.

Für den Nutzer ist trotzdem unklar, welcher Wert den gemeinsamen Stand der Sitzung darstellt.

### 3. Ausgaben und Analysen überschneiden sich fachlich

Ausgaben bietet bereits Zeitraumwahl, Kategorien, Händlergruppen, Kontofilter und Buchungsdetails. Analysen zeigt ebenfalls Kategorien, Zeitvergleiche, Ausgabenklassen und größte Positionen.

Die aktuelle Grenze lautet damit nicht eindeutig:

- Wo untersuche ich eine Ausgabe?
- Wo untersuche ich eine Veränderung?
- Wo identifiziere ich einen konkreten Hebel?

### 4. Prüfen und Planen verwenden dieselben Maßnahmen in verschiedenen Rollen

Prüfen enthält Klassifikation, regelmäßige Kandidaten und die Pflege von Maßnahmen. Planen zeigt reale Ausgabenhebel und deren Wirkung auf das FIRE-Modell.

Diese Redundanz ist grundsätzlich nützlich. Sie wird problematisch, wenn dieselbe Maßnahme an beiden Stellen bearbeitet werden kann oder ihr Status unterschiedlich wirkt.

### 5. Monatsinformationen sind auf mehrere Bereiche verteilt

- Übersicht: mehrmonatiger Geldfluss und Ausgaben eines Monats;
- Ausgaben: Monat, Quartal, YTD und Jahr mit Buchungs-Drill-down;
- Planen: Median-Monat, letzter und aktueller Monat, Monatsverlauf und Jahresendpfad.

Die Darstellungen können sinnvoll nebeneinander bestehen, wenn die jeweilige Frage klar benannt ist. Aktuell ist der Unterschied zwischen Beobachtung, abgeschlossenem Ist und Prognose nicht an jedem Einstieg sofort ersichtlich.

### 6. Quellenstatus erscheint mehrfach

Die Übersicht zeigt Datenbasis, Warnungen und einzelne manuelle Aufgaben. Status zeigt die vollständigen Quellen, Aufgaben, Systemzustand und manuelle Importabläufe.

Auf der Übersicht ist vor allem eine Ausnahme relevant. Eine vollständige Liste gesunder Quellen ist dort kein täglicher Arbeitsgegenstand.

### 7. Datenintensive Bereiche laden ihre Grundlage erneut

Im isolierten Review benötigten einzelne Bereiche mehrere Sekunden für ihre Daten. Die wiederholten Abrufe erschweren einen schnellen Wechsel und können voneinander abweichende Stichtände begünstigen.

Die gemessene Dauer der isolierten Instanz darf nicht ungeprüft als Produktionskennzahl verwendet werden. Der Workflow-Befund bleibt: Ein Seitenwechsel sollte keinen fachlich neuen Stand erzeugen, solange der Nutzer nicht aktualisiert oder ein definierter Snapshot abläuft.

## Vorgeschlagene Aufgabenverteilung

| Bereich | Primäre Aufgabe | Kompakte Orientierung erlaubt | Detail oder Bearbeitung |
|---|---|---|---|
| Übersicht | Abweichung und Handlungsbedarf erkennen | Heute, Monat, Jahr, FIRE, Aufgaben | Nur Deep Links |
| Ausgaben | Buchungen nachvollziehen | Summen und Kategorisierungsgrad | Kategorie, Händler, Konto, Einzelbuchung |
| Vermögen | Bestände und Wertveränderungen erklären | Gesamtwert und Aufteilung | Anlageklasse, Depot, Position, Bewertungsquelle |
| Prüfen | Offene Sachverhalte entscheiden | Anzahl und Priorität | Kategorisierung, Klassifikation, Maßnahme, Monatsabschluss |
| Planen | Zukunftswirkung berechnen | Jahres- und FIRE-Kurs | Szenarien und Hebelwirkung, nicht Stammdatenpflege |
| Analysen | Historische Muster und Ursachen erklären | wichtigste Veränderungen | Trends, Ausreißer, Vergleiche, veränderbare Kategorien |
| Status | Datenversorgung verwalten | Gesamtzustand | Quellenabrufe, Importe, Aktualität, Systemzustand |

## Vorgeschlagener Alltagsablauf

```text
Übersicht
  -> Abweichung oder Aufgabe erkennen
    -> Ausgaben oder Vermögen zum Nachvollziehen
    -> Prüfen zum Entscheiden und Bereinigen
    -> Planen zur Wirkung auf Jahres- und FIRE-Ziel
    -> Analysen für historische Muster
    -> Status nur bei Datenproblem oder manuellem Import
```

## Maßnahmen zur kritischen Bewertung

### M1 - Gemeinsamen Finanz-Snapshot einführen

Alle Bereiche verwenden für Vermögen, Marktwerte, Cashflow, Jahresausblick und FIRE-Berechnung denselben Snapshot und denselben sichtbaren Stichtag. Ein neuer Stand entsteht durch eine ausdrückliche Aktualisierung oder nach einer klar definierten Gültigkeitsdauer.

**Erwarteter Nutzen:** Konsistente Zahlen und weniger redundante Berechnungen.  
**Zu prüfen:** Snapshot-Grenzen, volatile Kurse, Cache-Dauer, manuelle Aktualisierung, Hintergrundjobs und Umgang mit Quellen unterschiedlicher Frische.

### M2 - Übersicht auf fünf Kernfragen verdichten

Die Startseite beantwortet primär:

1. Finanzvermögen heute;
2. aktueller Monat gegenüber typischem Monat;
3. YTD-Stand und Jahresendprognose;
4. aktueller FIRE-Kurs;
5. offene Aufgaben und Datenprobleme.

Die vollständigen Detaildarstellungen werden nicht gelöscht, sondern in ihre Fachbereiche verschoben oder dort verlinkt.

**Zu prüfen:** Ob FIRE auf der Startseite täglich relevant genug ist und welche der fünf Fragen oberhalb der ersten Bildschirmkante stehen sollen.

### M3 - Vermögensdetails konsequent unter Vermögen bündeln

Vollständiger Monatsvergleich, Veränderung je Anlageklasse, Depotpositionen und Bewertungsquellen gehören in den Vermögensbereich. Die Übersicht behält Gesamtwert, Gesamtveränderung und eine kompakte Aufteilung.

**Zu prüfen:** Ob die Vermögensbrücke auf der Übersicht als eingeklappte Erklärung verbleiben sollte.

### M4 - Ausgaben und Analysen semantisch trennen

**Ausgaben:** Buchung finden, Kategorie/Händler/Konto untersuchen, Beträge abstimmen.  
**Analysen:** Veränderungen, Ausreißer, Trends, Kostentreiber und Reduktionspotenziale erklären.

Analysen sollte nicht lediglich eine zweite Kategorienansicht sein, sondern standardmäßig Fragen beantworten wie:

- Was ist gegenüber Median oder Vorjahr gestiegen?
- Welche Einzelposten waren ungewöhnlich?
- Welche veränderbaren Kategorien beeinflussen den Jahrespfad?

### M5 - Maßnahmen nur unter Prüfen bearbeiten

Klassifikation, Status, erwartete Entlastung und Priorität werden unter Prüfen gepflegt. Planen zeigt die bestätigte Wirkung, den Umsetzungsstatus und einen Deep Link zur Bearbeitung.

**Erwarteter Nutzen:** Eine Quelle für Entscheidungen, aber sinnvolle Wiederholung ihrer Wirkung.  
**Zu prüfen:** Ob Szenario-spezifische Auswahl weiterhin direkt im Labor zulässig sein muss.

### M6 - Auf der Übersicht nur Statusausnahmen zeigen

Gesunde Quellen werden zu einer kompakten Aussage zusammengefasst. Nur fehlgeschlagene, veraltete, unvollständige oder auf den Nutzer wartende Quellen erscheinen als Aufgabe. Der vollständige Zustand bleibt unter Status.

### M7 - Kontext in Deep Links erhalten

Ein Klick nimmt Zeitraum, Monat, Kategorie oder betroffene Quelle mit:

- aktueller Monat -> Ausgaben im laufenden Monat;
- Jahresausblick -> Planen / Jahresausblick;
- FIRE-Kurs -> Planen / FIRE;
- Vermögensveränderung -> Vermögen mit passendem Bereich;
- Aufgabe -> direkter Prüf- oder Statusabschnitt.

**Zu prüfen:** Datenschutz in URLs und welche Filter dauerhaft teilbar sein sollen.

### M8 - Laufenden und abgeschlossenen Monat konsequent unterscheiden

Bezeichnungen wie `August bis heute`, `Juli abgeschlossen`, `Ist`, `Median-Pfad` und `[SCHÄTZUNG]` werden in allen Bereichen mit derselben Bedeutung verwendet. Ein Wechsel der Berechnungsbasis darf nicht nur aus dem Kontext erschlossen werden müssen.

### M9 - Seitenwechsel ohne unnötige Neubewertung

Bereits geladene Snapshot-Daten werden wiederverwendet. Nur eine bewusste Aktualisierung, ein fachlicher Schreibvorgang oder ein abgelaufener Snapshot erzeugt einen neuen Stand.

**Abgrenzung:** Dies ist nicht nur eine Performance-Optimierung, sondern verhindert widersprüchliche Momentaufnahmen.

### M10 - Analysen handlungsorientiert priorisieren

Vorgeschlagene Standardreihenfolge:

1. größte Abweichungen;
2. ungewöhnliche Einzelposten;
3. gegenüber Vorjahr gestiegene Kategorien;
4. real reduzierbare Kategorien;
5. Wirkung möglicher Reduktionen auf Jahres- und FIRE-Ziel.

## Redundanzen, die bewusst bleiben sollten

- Gesamtvermögen auf Übersicht und Vermögensseite;
- kompakte Monatsbilanz auf Übersicht und vollständiger Drill-down unter Ausgaben;
- kompakter FIRE-Kurs auf Übersicht und vollständiges Modell unter Planen;
- Anzahl offener Aufgaben auf Übersicht und Bearbeitung unter Prüfen beziehungsweise Status;
- Datenstand direkt an wichtigen Zahlen und vollständige Quellenhistorie unter Status;
- bestätigte Maßnahmen unter Prüfen und ihre finanzielle Wirkung unter Planen.

Voraussetzung ist immer: gleiche Datenbasis, klar anderer Zweck und nur ein Bearbeitungsort.

## Vorläufige Priorisierung

1. **M1 + M9:** gemeinsamer Snapshot und keine unnötige Neubewertung;
2. **M2:** verdichtete Übersicht;
3. **M7 + M8:** kontexttreue Navigation und eindeutige Zeitbasis;
4. **M4:** Ausgaben und Analysen trennen;
5. **M5:** Prüfen und Planen entflechten;
6. **M3 + M6:** Vermögensdetails und Statusinformationen richtig platzieren;
7. **M10:** Analysen handlungsorientiert neu ordnen.

## Nicht Teil dieses Vorschlags

- keine Änderung der Finanzmodelle oder FIRE-Annahmen;
- keine neue Bank- oder Kreditkartenanbindung;
- keine Vermischung von Immobilie und Finanzvermögen;
- keine Entfernung von Detailinformationen;
- keine automatische Neuklassifikation von Buchungen;
- keine Umsetzung vor Abschluss des Zweitreviews und erneuter Freigabe.

## Gewünschtes Format für die Rückgabe

Bitte das Review als Tabelle zurückgeben:

| ID | Urteil | Begründung | Risiko/Abhängigkeit | empfohlene Priorität | konkrete Anpassung |
|---|---|---|---|---|---|
| M1 | Zustimmung / Anpassen / Ablehnen | ... | ... | P0/P1/P2/P3 | ... |

Danach bitte ergänzen:

1. drei stärkste Gegenargumente gegen das vorgeschlagene Zielbild;
2. fehlende Maßnahmen;
3. eine vereinfachte Minimalvariante;
4. eine klare Empfehlung, womit begonnen werden sollte;
5. ausdrückliche Angabe, welche Aussagen vor Umsetzung noch live oder im Code verifiziert werden müssen.

---

# Hermes-Zweitreview — 24.08.2026, Abend

**Reviewer:** Hermes / Grok  
**Gegen:** dieses Dokument, Live `ghcr.io/myhacsint/finance-sync:0.42.2` (healthy), Code auf `review-inbox-next`  
**Thread seit Übergabe 0.38:** Codex `01a001f9-…` am 24.08. — Review des 0.38-Handoffs, dann UX-Slice (Depot-Drilldown, Prüfen-Trennung, Actual/Ghostfolio-Links, Depot-GuV, Asset-Filter), danach genau dieser Workflow-Review.  
**Status:** nur Stellungnahme. Keine Umsetzung aus diesem Abschnitt.

Gesamt: Das Zielbild (Alltag = erkennen → nachvollziehen → entscheiden → Wirkung) ist richtig. Die vorgeschlagene Sieben-Reiter-Trennung ist schon die heutige Navigation (`Labor` heißt live `Planen`). Der eigentliche Schaden sitzt nicht in fehlenden Reitern, sondern in **zwei Vermögensrechnern**, **getrennten 5-Minuten-Caches** und einer **Übersicht, die vier Fachseiten nachspielt**. Mehrere M-Punkte sind dasselbe technische Problem mit neuem Namen.

## Tabelle

| ID | Urteil | Begründung | Risiko/Abhängigkeit | empfohlene Priorität | konkrete Anpassung |
|---|---|---|---|---|---|
| M1 | **Anpassen** | Beobachtung der abweichenden Gesamtsummen ist glaubwürdig und im Code erklärbar. Übersicht: `cashSnapshot` + Ghostfolio-Overview + Gold. Vermögen: letzte `balances` + Ghostfolio-Holdings pro Konto + Gold. SOL-Monatsvergleich zusätzlich über CoinGecko-Tageskurs am letzten Monatsende. Getrennte Caches (`overviewCache`, `assetsCache`, je 5 min, eigener `generatedAt`). Ein „Snapshot-Objekt durchreichen“ heilt die **14-Euro-Klasse nicht**, solange die Formeln verschieden bleiben. | Volatile Kurse; Ghostfolio vs. CoinGecko; manuelle Vorsorge vs. Marktwert. Zu breiter Snapshot (Actual+Ghostfolio+CoinGecko atomar) macht jeden Klick langsam oder stale. | **P0** | Zuerst **eine** `buildWealthSnapshot()`-Funktion für `totalMinor` / Cash / Depots / SOL / Gold / Vorsorge. Beide Seiten rendern diese Summe. `generatedAt` sichtbar. Erst danach über Cache-Lebensdauer reden. |
| M2 | **Anpassen** | Übersicht ist tatsächlich überladen (Vermögen, Brücke, voller Monatsvergleich, Geldfluss mit Zeitraum, Aufteilung, Ausgaben mit Monatsselect, komplette Datenbasis, Vorsorge-Aufgaben). Die vorgeschlagenen fünf Kernfragen sind **nicht** der Ist-Zustand: FIRE und YTD/Jahresende liegen nur unter Planen. Sie dort zusätzlich auf die Startseite zu ziehen, verdichtet nicht — es kopiert Planen. | Widerspricht `finance-hub-ui` Product Rules, die Übersicht bewusst als Net-worth + Cashflow + Spending + Freshness definieren. Leere Startseite ohne Geldfluss wäre ein Rückschritt für den Morgenblick. | **P1** | Oben lassen: Vermögen heute, Δ seit Monatsende, 1-Zeilen-Cashflow, Ausnahme-Aufgaben. Geldfluss/Ausgaben/Aufteilung als Sekundärblock oder Deep Link. **Kein** FIRE-Kurs auf der ersten Kante, außer einer Zahl + Link nach Planen. |
| M3 | **Zustimmung** | Vollständiger Monatsvergleich je Klasse und die große Aufteilung gehören nach Vermögen. Übersicht behält Gesamtwert + Δ. | Nutzer, die nur Übersicht anfassen, verlieren den Soll-Ist-Vergleich, wenn der Deep Link fehlt (heute ist „Details in Vermögen“ **disabled**, Text „folgt als eigener Schritt“ — obwohl `#/assets` existiert). | **P2** nach M7 | Vergleichspanel nach Vermögen. Auf Übersicht nur Summe + Δ. Den toten Link sofort beleben, unabhängig von M3. |
| M4 | **Zustimmung** | Live-Analysen „Ausgabenstruktur“ ist eine zweite Kategorienansicht plus Klassen plus Top-12. Ausgaben kann dasselbe schon nach Zeitraum/Händler. Die sinnvolle Grenze steht im Dokument richtig. Krypto-Analyse ist **kein** Duplikat und darf nicht in denselben Umbau fallen. | Analysen ohne Kategorienleiste wirkt leer, bis Abweichungsfragen echte Queries haben. | **P2** | Default: größte Abweichung vs. Vorjahr/Median, Ausreißer, veränderbare Klassen. Kategorie-Balken nachrangig. Krypto-Tab unangetastet. |
| M5 | **Anpassen** | Klassifikation und Maßnahmen-Status gehören nach Prüfen. Planen darf Wirkung zeigen. **Szenario-Slider** (Monat Δ, Einmalposten, Realrendite, Trendbasis) sind keine Stammdaten — die müssen in Planen bleiben. Live sieht Planen keine offensichtlichen Status-Editoren für Recurring; das Risiko ist kleiner als beschrieben. | Wenn Szenario-Auswahl nach Prüfen wandert, wird Planen unbenutzbar. | **P3** | Schreibrecht Maßnahmen nur Prüfen. Planen: Status read-only + Link ` #/review`. Slider und Szenarien bleiben in Planen. |
| M6 | **Zustimmung** | Übersicht listet Giro/Depot/SOL/Vorsorge immer, auch wenn grün. Status hat dieselbe Geschichte vollständig. Alltag braucht nur Fail/Stale/Wartet. | „Vorsorge prüfen“ ist oft kein Fehler, sondern der bewusste Manual-Rhythmus. Nicht als Critical-Task ins Cockpit knallen. | **P1** (billig) | Eine Zeile „Quellen aktuell“ oder N Ausnahmen. Manual-Vorsorge nur wenn älter als vereinbarte Schwelle. |
| M7 | **Zustimmung** | Fast keine kontexttreuen Sprünge. Ausgaben-Link ohne Monat. Vermögens-Link tot. Prüfen-Inbox erscheint auf der Übersicht gar nicht. Hash-Filter (`#/spending?…`) sind datenschutzunkritisch (keine IBAN). | Zu viele Query-Keys werden zu einer zweiten Zustandsmaschine neben `expenseSelection()`. | **P1** | Wenige Keys: Monat/Zeitraum, Kategorie, Asset-Bereich, Review-Monat. Toten Vermögenslink zuerst. |
| M8 | **Zustimmung** | Die Unterscheidung existiert schon bruchstückweise (`complete`, „laufender Monat“, `partial`). Die Wörter sind nicht vertraglich. Planen mischt Median, Ist, Hochrechnung; Übersicht markiert Monate mit `*`. | Reine Copy-Änderung ist billig; eine neue Zeitachse im Backend wäre Overkill. | **P1** Copy, nicht Modell | Glossar festziehen: `Juli abgeschlossen` / `August bis heute` / `Ist` / `Median-Pfad` / `[SCHÄTZUNG]`. Überall dieselben drei Wörter. |
| M9 | **Anpassen** | Dasselbe wie M1. Eigenes Großprojekt lohnt nicht. Seitenwechsel *soll* keinen neuen Marktstand erzeugen; Refresh-Button schon. 5-Minuten-TTL je Endpoint ist die heutige, getrennte Näherung. | Langes Halten eines Ghostfolio-Stands auf Vermögen, während Übersicht neu zieht, erzeugt genau den Bug, den man heilen will — nur umgekehrt. | **P0** mit M1 | Ein Wealth-Cache, ein `generatedAt`, Refresh invalidiert alle Leser. Actual-Buchungen dürfen eigenen Cache behalten (andere Frage). |
| M10 | **Anpassen** | Richtige Richtung, aber nach M4. Heute Analysen umsortieren ohne Semantikwechsel ist Kosmetik. Punkt 5 (Wirkung auf FIRE) gehört nach Planen, nicht als fünfter Analysen-Block. | FIRE in Analysen verdoppelt Planen erneut. | **P3** | Nach M4. FIRE nur verlinken. |

## Antworten auf die sieben Leitfragen

1. **Nützliche Redundanz:** Gesamtvermögen auf Übersicht + Vermögen; kompakte Monatszahl + Ausgaben-Drilldown; Aufgabenanzahl + Prüfen; Datenstand an der Zahl + Status; bestätigte Hebel in Prüfen + Wirkung in Planen. Das darf bleiben.

2. **Schädliche Wiederholung:** zwei Vermögenssummen aus zwei Pipelines; Ausgabenkategorien auf Übersicht **und** Ausgaben **und** Analysen; voller Quellenkatalog auf Übersicht **und** Status; Monatsvergleich auf Übersicht, obwohl Vermögen die Fachseite ist; „Details in Vermögen“ als Fake-Link.

3. **Reiter-Trennung:** Fachlich ja, und sie ist live schon so. Umbenennen/Neu-schneiden der sieben Bereiche löst den Alltag nicht.

4. **Im täglichen Einstieg fehlt:** Zahl der offenen Prüfpunkte (unkategorisiert + Maßnahmen); ein Satz zum laufenden vs. abgeschlossenen Monat; Deep Link in den betroffenen Bereich; ein gemeinsamer Stichtag. FIRE-Zielalter ist **kein** täglicher Einstieg.

5. **Zu groß / falsch priorisiert:** monolithischer Finanz-Snapshot über alle Domänen; Übersicht zu einem zweiten Planen machen; Maßnahmenpflege aus Planen reißen, bevor klar ist, dass sie dort überhaupt geschrieben wird; Analysen-FIRE.

6. **Einfachere Alternative:** Eine Wealth-Funktion + Ausnahmezeile + drei echte Links. Kein IA-Umbau.

7. **Technisch vorher:** Gemeinsame Totals. SOL nicht parallel Ghostfolio **und** CoinGecko als „heute“. Cache-Bust in `ui.ts` steht noch auf `app.js?v=0.41.0` bei Produkt `0.42.2` — nach UI-Änderungen nicht vergessen, sonst reviewt man Geister.

## 1. Drei Gegenargumente gegen das Zielbild

1. Die Product Rules wollen die Übersicht bewusst breit (Vermögen, Cashflow, Ausgaben, Frische). Eine Fünf-Fragen-Kachelwand kann den Morgenblick zerstören, der schon funktioniert.
2. „Ein Snapshot für alles“ klingt nach Konsistenz, erzwingt aber entweder faule Kurse auf Vermögen oder teure Komplettneuberechnung inkl. Actual. Besser: ein Wealth-Snapshot, Actual weiter eigen.
3. Analysen ohne Kategorievergleich nimmt die einzige Stelle weg, an der zwei Jahre nebeneinander stehen. Ausgaben kann das heute nicht.

## 2. Fehlende Maßnahmen

- **M0 / Bug:** Übersicht → „Details in Vermögen“ ist absichtlich disabled, obwohl `#/assets` existiert. Sofort beheben, kein Review-Zyklus wert.
- **M11:** Übersicht zeigt keine Review-Inbox (offene Buchungen / Maßnahmen). Ohne die Zahl ist Frage 5 aus M2 leer.
- **M12:** Zwei SOL-Bewertungen (Ghostfolio-Marktwert vs. CoinGecko-Stichtag) explizit machen oder eine Quelle wählen. Sonst bleibt eine Differenz auch nach „gemeinsamem Snapshot“.
- Asset-Filter-Regression (24.08., zurück auf Gesamt statt Edelmetalle) nicht als IA-Thema verwechseln — das war State, kein Informationsarchitektur-Fehler.
- Offene Produktreste aus 0.38 bleiben gültig und sind **nicht** durch diesen IA-Vorschlag ersetzt: Miles-&-More-Ausgleich, Rest-Sonstige, Friseur-Kategorie, Mitarbeiteraktien-Betrag, wirksamer Monatsabschluss.

## 3. Minimalvariante

Nicht die Navigation anfassen.

1. `buildWealthSnapshot()` für Übersicht und Vermögen.  
2. Dieselbe `generatedAt`-Zeile.  
3. Frische auf Ausnahmen.  
4. Drei Links mit Kontext: Ausgaben (Monat), Vermögen (Bereich), Prüfen (Inbox).  
5. Copy-Vertrag laufend/abgeschlossen.

Das erreicht ~80 % von M1/M6/M7/M8/M9 ohne Planen oder Analysen umzubauen.

## 4. Womit beginnen

**M1 in der engen Lesart (eine Vermögensformel) + M6 + der tote Vermögenslink.**  
Danach M7/M8. Übersicht erst verdichten, wenn die Zahl auf beiden Seiten identisch ist — sonst baut man ein schöneres Cockpit auf einer lügenden Summe.

Nicht beginnen mit: neuem Snapshot-Service, Analysen-Rewrite, FIRE auf der Startseite, Maßnahmen-Umzug.

## 5. Noch zu verifizieren vor Umsetzung

Bereits im Code geprüft (keine Annahme mehr): getrennte 5-min-Caches; verschiedene Total-Builder; disabled Vermögenslink; Analysen = Kategorievergleich; Planen-Slider lokal; Live 0.42.2 healthy.

Vor einem großen Snapshot-Bau noch live messen, nicht nur aus dem isolierten Review übernehmen:

- dieselben zwei Totals in **einer** Minute gegen dieselben APIs (`/api/dashboard/overview` vs `/api/dashboard/assets`) und die Teilspalte, die wandert (SOL vs. Depot);
- ob Planen irgendwo `setRecurringExpenseOptimization` schreibt (UI wirkt read-only, API existiert);
- ob Nutzer die Übersicht als einzigen Tagesort nutzen oder ohnehin nach Ausgaben/Prüfen springen.

Annahme, nicht belegt: die 14 Euro seien nur Timing. Sie können Timing **oder** Formel sein. Erst Teilsummen vergleichen, dann Cache bauen.
