import type { AppConfig, NormalizedActivity } from "../types.js";
import { readSecret } from "../config.js";

export async function pushToGhostfolio(
  config: NonNullable<AppConfig["ghostfolio"]>,
  activities: NormalizedActivity[]
): Promise<number> {
  if (!config.enabled || activities.length === 0) return 0;
  const securityToken = readSecret("ghostfolio-security-token");
  if (!securityToken) throw new Error("Secret ghostfolio-security-token fehlt");
  const authResponse = await fetch(new URL("/api/v1/auth/anonymous", config.serverUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ accessToken: securityToken }),
    signal: AbortSignal.timeout(30_000)
  });
  if (!authResponse.ok) {
    throw new Error(`Ghostfolio Anmeldung HTTP ${authResponse.status}`);
  }
  const authPayload = await authResponse.json() as { authToken?: string };
  if (!authPayload.authToken) {
    throw new Error("Ghostfolio Anmeldung lieferte keinen Bearer-Token");
  }
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
      authorization: `Bearer ${authPayload.authToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ activities: mapped }),
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Ghostfolio Import HTTP ${response.status}`);
  return mapped.length;
}
