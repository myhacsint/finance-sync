# Handoff — Finance Hub 0.32.0–0.38.0 (Hermes, 23.08.2026)

Für ChatGPT Desktop / Codex. Branch `review-inbox-next` in
`/home/eh/Dokumente/Codex/2026-08-10/ich-habe-chatgpt-desktop-neu-gestartet/finance-sync`.
**Produktion: `ghcr.io/myhacsint/finance-sync:0.38.0`**, healthy.
Rollback-Container: `FinanceSync-0.37.0`.
Health: `https://homeserver.coin-matrix.ts.net:8080/health`.

Vorläufer (nicht überschreiben, nur Kontext):

- `docs/review-2026-08-23.md` — Produktreview 0.29.2
- `docs/handoff-2026-08-23-review-queue.md` — 0.30 Review-Queue
- `docs/handoff-2026-08-23-review-next.md` — 0.31 Income/Lab-Tabs/FIRE-Config

Voice-Thread-Quelle: `codex://threads/01a001f9-b50f-7163-9f02-35cf8e34f15d`
(`~/.codex/sessions/2026/08/14/rollout-2026-08-14T22-32-17-01a001f9-b50f-7163-9f02-35cf8e34f15d.jsonl`).

## Auftrag dieser Session

1. Voice-Thread lesen.
2. Review-Rest umsetzen, **ohne Live-KK**.
3. Ausgaben-UI (Filter, Gruppen wie Labor, Pagination).
4. Sonstige-Ausgaben umkategorisieren + Arzt netto.
5. Offene Produktpunkte 1–6 und 8 bauen. Punkt 7 (Vorsorge-Frische) macht Erik selbst; Gold bleibt statisch.

## Changelog (live)

| Version | Inhalt |
|---|---|
| **0.32.0** | FIRE-Phasenmodell vs. 20-Jahres-Cashflow getrennt beschriftet. Nur bestätigte laufende Maßnahmen zählen als Hebel. „Nächste 5 prüfbare Dinge“. Persistente Händlerregeln (Amazon/Claude/PayPal/OpenAI + DB). Plan vs. Ist mit Begründungen (offene KK, unzugeordnetes Income, Doppelgehalt, unvollständiger Monat). |
| **0.33.0** | Benannte Laborszenarien speichern/laden. Mitarbeiteraktien/SAP als optionaler monatlicher Zufluss (`analysis.savingsBaseline.employeeStockBenefitMonthlyMinor`, Default **0**). `[SCHÄTZUNG]` einmal oben, nicht an jeder Zahl. |
| **0.34.0** | Ausgaben-Zeiträume: Monat (inkl. laufender), Quartal, YTD, Jahr. Sortierung Datum/Händler/Betrag. ISO-Daten in der Liste auf `de-DE`. |
| **0.35.0** | Ausgaben wie Labor → Variable Kategorien: Händlergruppen aufklappbar, größte Summe zuerst. |
| **0.36.0** | Arzt: brutto / Oldenburger erstattet / netto (Selbstbehalt). Kein Rechnungs-Matching. |
| **0.37.0** | Pagination zählt **Gruppen**, nicht Buchungen. |
| **0.38.0** | Miles-&-More-Paste in Status (wie Sutor). Prüfen: 24-Monatsfenster, Händlerregeln-UI, Monatsabschluss. Labor: datierte Ereignisse, Lücke 66→60, Szenarienvergleich. |

Git-Tags: `v0.32.0` … `v0.38.0` auf `review-inbox-next`.

## Entscheidungen (nicht aufweichen)

- **Live-KK Miles & More über Enable Banking geht nicht.** Quelle `deutsche-bank-miles-more` ist disabled. DB-AIS = Giro (ID + Unterkonto + PIN), keine Card-Accounts. FinanzPlaner der Bank hat KK intern erst „im Laufe 2026“. Kein Scraper. Import = Status-Paste + Parser + Actual-Konto `Kreditkarte`. Giro-Ausgleich/Transfer-Link ist in 0.38 **nicht** gebaut (altes Script `scripts/import-miles-more-actual.mjs` kann das noch).
- **„Inbox“** meinte `/mnt/user/finance-inbox` (Drop-Ordner). Erik will das **nicht**. Manuell wie Sutor/AL.
- Private Gegenparteien **nicht anonymisieren**.
- Zwei Modelle getrennt halten: FIRE-Phasenmodell ≠ 20-Jahres-Cashflow.
- Kategorie-% und historische Einmalposten zählen **nicht** ins FIRE-Szenario.
- Arzt/PKV: Beitrag = Versicherungen; Leistungen = negatives Arzt; Netto über YTD/Quartal, nie 1:1 matchen.
- Gold physisch, Wert **statisch** bis Erik etwas anderes sagt.
- Mitarbeiteraktien-Betrag nicht gesetzt (0). Nicht raten.
- Produktion nur nach Tests + Pre-Update-Backup; kein stiller Rollout. Unraid-Scripts: `Finance Hub - Pre Update`, Image `ghcr.io/myhacsint/finance-sync:<ver>` + Tag `stable`.

## Actual-Umkategorisierung (YTD 2026, schon geschrieben)

Nur aus **Sonstige** bzw. explizit genannten Quellen, 23.08. abends:

- Bye.Bye → Urlaub; MVZ Labor/Volkmann/PVS BW/Kubowitsch/Osteo Schwebler → Arzt
- Friedrich Report: 4× aus Sonstige + **2× aus Abonnements** (6.7. und 4.8.) → Sparen & Investieren
- Hopf-Klinkmüller 6× aus Abos → Sparen & Investieren
- Volksbank Münzesheim, Sparkasse Kraichgau → Bargeld
- Ski/Fraport/Parkster → Urlaub
- Lascana/Ernsting/Mode Wagener/Kik/Sebastian Frei → Kleidung
- Proton → Homelab; Nabu/Malteser → Spenden
- Okidoki/Ohdoki/Lea Spreizenbarth/SV Blau-Weiß Menzingen → Kinder
- Metzlers Futtermühle → Haustiere
- Weingut/Görtz/Gmeiner → Lebensmittel
- Alena Dell (Friseur) → **Drogerie** (keine Friseur-Kategorie)
- Beyerle Blumen → Haushalt; Davy’s Pinseria → Restaurants

Sonstige hat noch Restbrocken (Personenüberweisungen, Google, …). Nicht anfassen ohne Erik.

## UI-Karten

- Nav: Übersicht, Ausgaben, Vermögen, **Prüfen**, **Labor**, Analysen, Status
- Ausgaben: Periodenchips + Select; Gruppen; Sortierköpfe; Arzt-Band bei Alle/Arzt
- Prüfen: Zeitraum 3/6/12/**24**; Monatsabschluss; Händlerregeln
- Labor: FIRE / Jahr / Pfad; Szenarien speichern; Ereignisse; Vergleich; Lücke 66→60
- Status: **Miles & More Abrechnung** (Datum + Text, Vorschau, Import) **über** Sutor/AL

## Wichtige Dateien

- `src/ui/client.ts` — eingebettetes UI-JS (escaped String; `patch` bricht oft, Python-Rewrite)
- `src/ui/styles.ts`, `src/ui.ts`
- `src/dashboard-spending.ts` — Perioden, Gruppen, Pagination, `medicalBreakdown`
- `src/dashboard-fire.ts` + `src/fire-gap.ts`
- `src/dashboard-decision-lab.ts`, `src/dashboard-review.ts`
- `src/merchant-rules.ts`, `src/named-scenarios.ts`, `src/life-events.ts`, `src/scenario-compare.ts`
- `src/miles-more-statement.ts`, `src/miles-more-import.ts` (Import ohne Settlement-Link)
- `src/database.ts` — `merchant_rules`, `named_scenarios`, `life_events`, `month_closes`
- `src/service.ts`, `src/server.ts`
- `scripts/import-miles-more-actual.mjs` — alter CLI-Weg **mit** Giro-Ausgleich

## APIs neu/erweitert

```
GET/PUT/DELETE /api/dashboard/merchant-rules
GET/PUT/DELETE /api/dashboard/events
PUT             /api/dashboard/review/close          { month, note }
GET             /api/dashboard/scenarios/compare?left=&right=
POST            /api/miles-more/preview              { text, statementDate }
POST            /api/miles-more/import               { text, statementDate }
GET             /api/dashboard/review?months=3|6|12|24
GET             /api/dashboard/spending?period=month|quarter|ytd|year&month=&quarter=&year=&sort=
```

## Verifikation

```
cd /home/eh/Dokumente/Codex/2026-08-10/ich-habe-chatgpt-desktop-neu-gestartet/finance-sync
npm test
# 123 Node + 6 Python, Stand 0.38.0
```

Nach Deploy: hart neu laden. Ausgaben YTD + Versicherungen = eine Seite wenn ≤20 Gruppen. Status Miles-&-More-Block sichtbar. Labor FIRE zeigt „Lücke … → 60“.

## Infra

- Host: Unraid `homeserver` / Tailscale `100.66.40.40`
- Container `FinanceSync`, Netz `finance-hub`, `127.0.0.1:8080`
- Daten `/mnt/user/appdata/finance-hub/finance-sync`, Secrets `/mnt/user/appdata/finance-hub/secrets`
- Backup vor jedem Update: User-Script `Finance Hub - Pre Update` → `/mnt/user/backup/finance-hub/daily/`

## Offen / nicht bauen ohne Rückfrage

- Live-KK Enable Banking
- Miles-&-More Giro-Ausgleich im UI (Script existiert)
- Vorsorge-Frische (Erik 24.08.)
- Gold-Neubewertung
- Mitarbeiteraktien-Betrag
- Rest-Sonstige
- Eigene Friseur-Kategorie
- Ereignis-UI listet gespeicherte Events noch dünn (Speichern wirkt; Liste/Löschen API ist da)

## Pick up

Review der Fläche 0.38 gegen dieses Dokument. Nicht 0.29-Reviewpunkte erneut „offen“ markieren, die schon live sind. Nächster sinnvoller Bau nur nach Erik: Settlement-Link für Miles-&-More oder Rest-Sonstige.
