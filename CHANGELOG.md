# Changelog

## 0.55.15 - 2026-11-20

Based on 0.55.14.

- DKB depot turnover (HKWDU) failure is a per-depot warning: the run finishes as SUCCESS, `/health` reports `warning` (critical after 60 days), and the other depots are still fetched.
- The bank's own status text (9010) is shown, with long digit runs masked and capped at 80 characters.
- Depot labels in messages show only the last three digits.

## 0.55.14 - 2026-11-20

Based on 0.55.13. Does not include the 0.55.12 autocontinue or the trace commit 5dc1d2d.

- DKB HKWDU turnover period reverted from 14 days (0.55.13 diagnostic) to 90 days.
- UI "Jetzt abrufen": result is shown after the refresh (refresh no longer clears it) and scrolled into view.
- Failed syncs (HTTP 500 with `{state,message}`) now show the server message instead of "Internal Server Error".
