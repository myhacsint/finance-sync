import type { FinanceDatabase } from "./database.js";
import type { GhostfolioAssetSnapshot } from "./dashboard-assets.js";

export function marketSnapshotDate(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function archiveGhostfolioMarketSnapshot(
  db: FinanceDatabase,
  snapshot: GhostfolioAssetSnapshot,
  timezone: string,
  now = new Date(),
  expectedAccountIds = Object.keys(snapshot.valuesByAccount)
): { valuationDate: string; positions: number } {
  const valuationDate = marketSnapshotDate(now, timezone);
  const capturedAt = snapshot.capturedAt ?? now.toISOString();
  const sourceByAccount = db.assetAccountSources();
  const items = expectedAccountIds
    .map((accountId) => [accountId, snapshot.valuesByAccount[accountId]] as const)
    .map(([accountId, amountMinor]) => ({
      valuationDate,
      sourceId: sourceByAccount.get(accountId),
      accountId,
      capturedAt,
      amountMinor
    }))
    .filter((item): item is typeof item & { sourceId: string } =>
      Boolean(item.sourceId)
      && Number.isSafeInteger(item.amountMinor)
      && item.amountMinor >= 0
    );
  if (items.length === 0 || items.length !== expectedAccountIds.length) {
    throw new Error("Ghostfolio-Marktwertarchiv ist unvollständig oder enthält keine Zuordnung");
  }
  db.upsertAssetMarketSnapshots(items);
  return { valuationDate, positions: items.length };
}
