import { archiveRaw } from "./archive.js";
import type { FinanceDatabase } from "./database.js";
import type { ImportBundle } from "./types.js";

export function importBundle(
  db: FinanceDatabase,
  archiveRoot: string,
  sourceId: string,
  bundle: ImportBundle
): Record<string, number> {
  const archived = archiveRaw(
    db,
    archiveRoot,
    sourceId,
    bundle.raw,
    bundle.rawMediaType
  );
  for (const item of bundle.transactions ?? []) item.rawHash ||= archived.hash;
  for (const item of bundle.balances ?? []) item.rawHash ||= archived.hash;
  for (const item of bundle.holdings ?? []) item.rawHash ||= archived.hash;
  for (const item of bundle.activities ?? []) item.rawHash ||= archived.hash;
  return {
    transactions: db.importTransactions(bundle.transactions ?? []),
    balances: db.importBalances(bundle.balances ?? []),
    holdings: db.importHoldings(bundle.holdings ?? []),
    activities: db.importActivities(bundle.activities ?? [])
  };
}
