import type { AppConfig, NormalizedActivity } from "../types.js";
import { readSecret } from "../config.js";

export async function pushToGhostfolio(
  config: NonNullable<AppConfig["ghostfolio"]>,
  activities: NormalizedActivity[]
): Promise<number> {
  if (!config.enabled || activities.length === 0) return 0;
  const token = readSecret("ghostfolio-access-token");
  if (!token) throw new Error("Secret ghostfolio-access-token fehlt");
  const mapped = activities
    .filter((item) => config.accountMap[item.accountId] && item.symbol)
    .map((item) => ({
      accountId: config.accountMap[item.accountId],
      currency: item.currency ?? "EUR",
      date: item.occurredAt,
      fee: Number(item.feeMinor ?? 0n) / 100,
      quantity: Number(item.quantityAtomic ?? "0") / 10 ** (item.atomicDecimals ?? 0),
      symbol: item.symbol,
      type: item.type,
      unitPrice: item.amountMinor && item.quantityAtomic
        ? Number(item.amountMinor) / 100 /
          (Number(item.quantityAtomic) / 10 ** (item.atomicDecimals ?? 0))
        : 0
    }));
  if (mapped.length === 0) return 0;
  const response = await fetch(new URL("/api/v1/import", config.serverUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ activities: mapped }),
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Ghostfolio Import HTTP ${response.status}`);
  return mapped.length;
}
