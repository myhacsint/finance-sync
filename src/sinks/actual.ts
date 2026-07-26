import type { AppConfig, NormalizedTransaction } from "../types.js";
import { readSecret } from "../config.js";

export async function pushToActual(
  config: NonNullable<AppConfig["actual"]>,
  transactions: NormalizedTransaction[]
): Promise<number> {
  if (!config.enabled || transactions.length === 0) return 0;
  const password = readSecret("actual-password");
  if (!password) throw new Error("Secret actual-password fehlt");
  const api = await import("@actual-app/api");
  await api.init({ dataDir: config.dataDir, serverURL: config.serverUrl, password });
  try {
    await api.downloadBudget(config.budgetId);
    let count = 0;
    for (const [sourceAccountId, actualAccountId] of Object.entries(config.accountMap)) {
      const matching = transactions.filter((item) => item.accountId === sourceAccountId);
      if (matching.length === 0) continue;
      const result = await api.importTransactions(
        actualAccountId,
        matching.map((item) => ({
          account: actualAccountId,
          date: item.bookedAt.slice(0, 10),
          amount: Number(item.amountMinor),
          payee_name: item.payee,
          notes: item.memo,
          imported_id: item.sourceTransactionId
            ? `${item.sourceId}:${item.sourceTransactionId}`
            : `${item.sourceId}:${item.rawHash}:${item.bookedAt}:${item.amountMinor}`
        }))
      );
      count += result.added?.length ?? 0;
    }
    await api.sync();
    return count;
  } finally {
    await api.shutdown();
  }
}
