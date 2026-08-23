# Handoff — 0.31.0 review income, lab tabs, FIRE config, UI split

Branch: `review-inbox-next` in
`/home/eh/Dokumente/Codex/2026-08-10/ich-habe-chatgpt-desktop-neu-gestartet/finance-sync`.

Not deployed. Production is still `0.30.0` until tagged.

## Shipped

1. **Income in `#/review`.** Uncategorized inflows are a separate list with income
   categories. Writeback still goes through FinanceSync → Actual.
2. **Multi-month window.** Default last 6 complete months; selector 3 / 6 / 12
   via `?reviewMonths=` and `GET /api/dashboard/review?months=`.
3. **Labor tabs.** FIRE-Kurs / Jahresausblick / Trajektorie (`?labView=`).
4. **FIRE assumptions in config.** `analysis.fire` in `config.json`. Defaults
   remain v3.1. Example keys in `config.example.json`.
5. **`ui.ts` split.** Shell in `src/ui.ts`; CSS `src/ui/styles.ts`; client
   `src/ui/client.ts`. `renderUi()` still concatenates for tests.

## Files

- `src/dashboard-spending.ts` — review mode + `reviewWindowSelection`
- `src/dashboard-review.ts` — income/expense split + window
- `src/fire-assumptions.ts` — defaults + `resolveFireAssumptions`
- `src/dashboard-fire.ts` — consumes assumptions
- `src/config.ts` / `src/types.ts` / `config.example.json`
- `src/ui.ts`, `src/ui/styles.ts`, `src/ui/client.ts`

## Verify

```
cd /home/eh/Dokumente/Codex/2026-08-10/ich-habe-chatgpt-desktop-neu-gestartet/finance-sync
npm test
```

106 tests green.

## Config (optional, production)

Add under `analysis` in `/app/data/config.json`:

```json
"fire": {
  "modelYear": 2026,
  "erikBirthYear": 1978,
  "wifeBirthYear": 1983,
  "inflation": 0.02
}
```

Omitted keys keep the hardcoded v3.1 defaults.

## Pick up

Tag `v0.31.0` and roll out like 0.30.0 (pre-update backup, pull image, replace
FinanceSync only). Then click `#/review` income list and Labor tabs.
