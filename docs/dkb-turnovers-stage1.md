# DKB depot turnovers: stage 1

The optional DKB source setting `fetchTransactions: true` adds read-only HKWDU5
requests to each holdings run (90-day overlapping window). Existing sources keep
their old behaviour until explicitly enabled. Initial history older than the
window is not claimed complete. Empty turnover responses are valid.

Native MT536 responses are archived privately with the holdings response.
Normalized `DEPOT_RECE` / `DEPOT_DELI` observations retain date, ISIN, exact
quantity, currency and bank-reported amount. They are deliberately not BUY/SELL:
delivery alone does not prove a trade. Fees remain null. Bank-reference plus
depot scope produces stable identities; conflicting revisions fail closed.

DKB observations are never published as Ghostfolio trades. Existing holdings
reconciliation is unchanged. Actual transactions, amounts and transfer links
are not automatically changed in this stage.

`GET /api/depot-settlements` (normal authenticated API) and
`exports/depot_settlements.csv` provide a recalculated evidence report:

- correct direction/currency and bank date within seven days;
- DKB/securities counterparty evidence and absolute amount difference <= EUR25
  only identify candidates, never prove a fee or a trade;
- multiple candidates or a bank transaction shared by observations: ambiguous;
- exact amount, ISIN and quantity in bank memo: evidence match, not auto-posting;
- missing evidence or any amount difference: manual review.

The report is not a tax statement. It does not read or invent PDF confirmations,
include private counterparties/memos in the endpoint, or alter existing expense
calculations. The later explicit classification/confirmation step is separate.

## Rollback

Disable the source flag and restore the prior versioned container. No destructive
schema migration is introduced; older versions tolerate extra activity rows.
Preserve raw archive and normalized observations. A verified pre-release database
and configuration backup is mandatory before enabling the flag in production.

## Verification

Synthetic parser and matching tests cover references, exact quantities,
truncation, missing fields, conflicting identities, ambiguity, no-write matching
and unknown fees. Full Node/Python and desktop/mobile regression suites pass.
An isolated real DKB read validated both the parser and combined holdings plus
turnover helper without database imports. Original personal documents/responses
are not included in tests or source control.
