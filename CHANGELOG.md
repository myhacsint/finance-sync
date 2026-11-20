# Changelog

## 0.55.14 - 2026-11-20

Based on 0.55.13. Does not include the 0.55.12 autocontinue or the trace commit 5dc1d2d.

- DKB HKWDU turnover period reverted from 14 days (0.55.13 diagnostic) to 90 days.
- UI "Jetzt abrufen": result is shown after the refresh (refresh no longer clears it) and scrolled into view.
- Failed syncs (HTTP 500 with `{state,message}`) now show the server message instead of "Internal Server Error".
