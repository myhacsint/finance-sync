# Monatscheck – approved implementation contract

Approved 2026-09-08: Prüfen → Monatscheck; existing Buchungen view and manual closes preserved. Pilot August 2026, navigable closed months. No new top-level navigation or financial mutations.

Design source: user-approved local `monatscheck-desktop-konzept.png` and `monatscheck-mobile-konzept.png` plus `monatscheck-konzept-2026-09-08.md` in the task workspace. Synthetic illustrations are not production findings.

## Inventory before coding

- Existing shell/sidebar/mobile navigation, Inter/system sans, canvas #080d19, surface #111a2c, line #26334a, text #f4f7fb, secondary #9caac0, blue/green/amber/red semantic tokens. No gradient, new logo, mobile gear, or external font.
- Copy: Prüfen, Buchungen, Monatscheck, Letzter abgeschlossener Monat, Konten & Zahlungswege, Saldenabgleich, Belegabdeckung, Zuordnung, Details, Warum nicht prüfbar?, Belege ansehen, Nächste Schritte. Actual data determines outcomes, counts and dates; no example badges in production.
- Desktop: horizontal month navigation, summary strip, table, selected account evidence panel, next-step list. Mobile: same hierarchy with stacked account summaries and inline evidence, 44px controls. Existing five-slot mobile navigation retained (approved correction to generated mockup).
- Heading 32px, section 22px, body/control 16px, captions 14px; spacing 8/16/24px, modest 8–16px radius. Existing chevrons, bank, document, warning, check SVG family. No new raster assets in shipped UI.
- Separate modules: deterministic checks, read-only evidence adapter, browser renderer; app entry point only coordinates routing. Selected details change locally; month navigation fetches new read-only response. Error/empty/loading/partial states retain navigation and never substitute zeros.
- Necessary copy additions: explicit evidence limitations, dates, source freshness and recovery guidance. No percent-complete score or automatic month-close action. Detailed state names come from backend reason codes.

## Security and data contract

Authenticated GET only, no-store, strict month validation. Evidence comes from existing local archive and read-only Actual download. No banking request, Actual sync/write, confirmation or migration. Raw files are hash-verified, size/path bounded and never served. Public rows use opaque keys and purpose labels, not account IDs or raw descriptions.

Independent booked closing balances at both boundaries are required for arithmetic reconciliation. A captured intraday or available balance is not an end-of-day balance. Existing raw responses do not prove a complete requested period: coverage remains unknown where that metadata is absent. Matching total alone does not prove completeness. Card/PayPal settlement coverage must not be inferred from merchant strings or matching amounts alone; unsupported legacy evidence remains explicitly unverified. Amazon is enrichment, never an added cash account.

## Acceptance ledger

Verified 2026-09-08 using synthetic fixtures at desktop 1440×1000 and mobile 375×812, including full-page screenshots:

| Contract | Result / intentional difference |
| --- | --- |
| Existing sidebar and five-slot mobile navigation | Preserved; no gear/logo/extra top-level item added |
| Buchungen / Monatscheck hierarchy | Same placement, active underline, existing page heading preserved |
| Horizontal month controls | Fixed a global select-width conflict found in screenshot comparison; closed-month arrows/select/back navigation pass |
| Account table → stacked mobile rows | Same three independent checks; no horizontal overflow at 375px |
| Typography, palette and icons | Existing flat semantic tokens; 16px row text, 44–48px controls, no gradients or external assets |
| Selected evidence detail | Desktop panel / mobile inline; keyboard-expand/collapse tested; longer factual explanations than concept to distinguish coverage from categorization |
| Belege ansehen | Native expandable sanitized evidence, not a raw download or external page |
| Next steps | Existing category review and source status; no invented credit-card upload |
| Loading / error / empty | Tabs remain available; missing amounts never render as zero; retry works |
| Safety | Browser navigation produces GET only; API rejects writes and invalid months; Council reads remain unauthenticated |

Screenshots are generated under ignored `test-results/month-check-{desktop,mobile}.png` and `month-check-error-{desktop,mobile}.png`. Interactive user-browser verification was blocked by a Brave extension popup while the user was remote; independent browser regression and screenshot review still completed. This is not evidence of a production UI check.

### Scope limits

This first check can use exact booked closing balances from existing Enable Banking raw responses. It deliberately cannot certify historical card/PayPal statement coverage or bank requested-period/pagination coverage absent an evidence registry. It does not import statements, infer missing balances, reconcile transfers, or close months. Files scanned: up to 256 JSON records, 8 MiB each, approximately 64 MiB total, four-day windows after month boundaries; exceeding limits makes evidence unavailable, not green. Foreign-currency bank movements are not compared with the EUR Actual budget. At most two different month reads can be outstanding.
