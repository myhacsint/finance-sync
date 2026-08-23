# Session Handoff — Review-Queue, eine Taxonomie, Labor in der Hauptnav

Für ChatGPT Desktop / Codex: Branch `review-queue-ia` in
`/home/eh/Dokumente/Codex/2026-08-10/ich-habe-chatgpt-desktop-neu-gestartet/finance-sync`.
Version **0.30.0**. Noch **nicht** produktiv ausgerollt.

## Where it started

Hermes hat den Voice-Thread `01a001f9-b50f-7163-9f02-35cf8e34f15d` gelesen und
Finance Hub 0.29.2 reviewed. Auftrag: Punkte 1–3 umsetzen (Review-Queue mit
Actual-Writeback, eine Taxonomie/Inbox, Entscheidungslabor in der Hauptnav),
dieselben Frontend-Skills wie ChatGPT nutzen, Protokoll für spätere Weiterarbeit
schreiben. Punkt 9 (Live-Miles-&-More) nur recherchieren.

## Design skills used

Copied from `~/.codex/skills/` into Hermes:

- `finance-hub-ui` → `~/.hermes/skills/creative/finance-hub-ui/`
- `frontend-app-builder`
- `ui-ux-pro-max`
- `web-design-guidelines`
- `session-handoff`

Surface: **Operate** (Inbox), existing Finance Hub tokens. No new visual system.
No separate desktop/phone concept round — existing components reused so the
implementation could ship in this session.

## Decisions locked + what shipped

- IA is now 7 top-level items: Übersicht, Ausgaben, Vermögen, **Prüfen**,
  **Labor**, Analysen, Status.
- `#/review` is the single inbox: uncategorized Actual bookings + recurring
  candidates + optimization actions.
- `#/decision-lab` is first-class. Legacy
  `?analysisView=decision-lab|recurring-expenses|expense-optimizations`
  redirects.
- One review taxonomy: `GRUNDBEDARF | GESTALTBAR | VERMEIDBAR | UNKLAR | KEIN_KANDIDAT`.
  Analysen-Ausgabenstruktur keeps its descriptive classes
  (`VERTRAGLICH` / `STRUKTURELL` / …). Do not merge those into the review
  taxonomy.
- `PUT /api/dashboard/review/transaction` writes category + payee into Actual
  (`updateTransaction` / `createPayee`) and optionally stores a FinanceSync
  merchant alias.
- `PUT /api/dashboard/review/merchant-alias` stores alias only.
- Browser never talks to Actual. Writeback stays on the FinanceSync server.
- Category UUIDs are not sent to the browser; mapping is server-side via
  `snapshot.catalog`.
- Miles & More live fetch is **not** implemented. PDF import remains the path.

## Key files

- `src/dashboard-review.ts` — queue builder, alias apply, Actual writeback
- `src/dashboard-review.test.ts`
- `src/dashboard-spending.ts` — snapshot now includes `catalog`
- `src/database.ts` — `merchant_aliases`
- `src/service.ts` — `getDashboardReview`, `applyReviewTransaction`, `applyMerchantAlias`
- `src/server.ts` — review routes
- `src/ui.ts` — nav, `#/review`, `#/decision-lab`, `renderReview`
- `src/ui.test.ts`
- `docs/review-2026-08-23.md` — earlier product review (uncommitted until this branch)
- `~/.hermes/skills/creative/finance-hub-ui/references/product-rules.md` — IA updated

## APIs

```
GET  /api/dashboard/review
PUT  /api/dashboard/review/transaction
     { lineId, categoryKey?, payeeName?, aliasTo? }
PUT  /api/dashboard/review/merchant-alias
     { fromKey, toLabel }
```

`lineId` is `parentId:transactionId` from spending lines.

## Verification

```
cd /home/eh/Dokumente/Codex/2026-08-10/ich-habe-chatgpt-desktop-neu-gestartet/finance-sync
npm test
```

101 tests green locally. Production still runs `0.29.2` on
`https://homeserver.coin-matrix.ts.net:8080`.

After deploy: open `#/review`, categorize one uncategorized booking, confirm it
moves in Actual and disappears from the inbox after refresh. Open `#/decision-lab`
from the Labor nav item. Check 375px: 7-item mobile nav must not overflow.

## Miles & More (point 9)

Deutsche Bank Miles & More is a co-branded **card**, not a standard DB Giro
AIS account. Enable Banking’s Deutsche Bank connector authenticates with
Deutsche Bank ID + Unterkonto + PIN for current accounts. This card product
does not appear as that standard web service — confirmed by the earlier failed
attempt in the voice thread and by DE open-banking practice (card accounts
often absent from PSD2 AIS).

Keep `scripts/import-miles-more-actual.mjs` + open-balance overlay.
Do not add a scraper. Revisit only if Enable Banking or Deutsche Bank publishes
an explicit card-account AIS for Miles & More.

## Deferred + open questions

- Not deployed. Needs the usual Finance-Hub backup + image promote.
- Review inbox only covers the latest complete spending month for
  uncategorized bookings. Multi-month queue is future work.
- Income categorization is still excluded by the spending normalizer
  (income lines are dropped). User previously classified income via voice.
- `ui.ts` is still one HTML string. Do not grow it much further; extract if
  the next feature is another surface.
- FIRE assumptions remain hardcoded in `dashboard-fire.ts` (review item 5).
- No named scenarios yet (review item 12).
- 7-item mobile nav is tight; shorten labels further if 375px wraps badly.

## Pick up here

1. Visually check `#/review` and `#/decision-lab` in the authenticated hub.
2. If good, run the existing pre-update backup and publish `0.30.0` / `stable`.
3. Next product slice: income in the review inbox, or extract `ui.ts`.
