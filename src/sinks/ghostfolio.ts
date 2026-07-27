import type {
  AppConfig,
  NormalizedActivity,
  NormalizedHolding
} from "../types.js";
import { readSecret } from "../config.js";

async function authenticate(
  config: NonNullable<AppConfig["ghostfolio"]>
): Promise<string> {
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
  return authPayload.authToken;
}

export async function pushToGhostfolio(
  config: NonNullable<AppConfig["ghostfolio"]>,
  activities: NormalizedActivity[]
): Promise<number> {
  if (!config.enabled || activities.length === 0) return 0;
  const supportedTypes = new Set([
    "BUY", "DIVIDEND", "FEE", "INTEREST", "LIABILITY", "SELL"
  ]);
  const mapped = activities
    .filter((item) =>
      config.accountMap[item.accountId]
      && item.symbol
      && supportedTypes.has(item.type)
    )
    .map((item) => ({
      accountId: config.accountMap[item.accountId],
      currency: item.currency ?? "EUR",
      dataSource: "YAHOO",
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
  const authToken = await authenticate(config);
  const response = await fetch(new URL("/api/v1/import", config.serverUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${authToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ activities: mapped }),
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Ghostfolio Import HTTP ${response.status}`);
  return mapped.length;
}

interface GhostfolioPosition {
  quantity?: number;
  assetProfile?: {
    dataSource?: string;
    symbol?: string;
  };
}

async function currentQuantity(
  config: NonNullable<AppConfig["ghostfolio"]>,
  authToken: string,
  accountId: string,
  dataSource: string,
  symbol: string
): Promise<number> {
  const url = new URL("/api/v1/portfolio/details", config.serverUrl);
  url.searchParams.set("accounts", accountId);
  url.searchParams.set("dataSource", dataSource);
  url.searchParams.set("symbol", symbol);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${authToken}` },
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) {
    throw new Error(`Ghostfolio Positionsabfrage HTTP ${response.status}`);
  }
  const payload = await response.json() as {
    holdings?: Record<string, GhostfolioPosition>;
  };
  return Object.values(payload.holdings ?? {}).find(
    (holding) =>
      holding.assetProfile?.dataSource === dataSource
      && holding.assetProfile?.symbol === symbol
  )?.quantity ?? 0;
}

async function waitForQuantity(
  config: NonNullable<AppConfig["ghostfolio"]>,
  authToken: string,
  accountId: string,
  dataSource: string,
  symbol: string,
  expected: number,
  tolerance: number
): Promise<number> {
  let quantity = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    quantity = await currentQuantity(
      config,
      authToken,
      accountId,
      dataSource,
      symbol
    );
    if (Math.abs(quantity - expected) < tolerance) return quantity;
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  return quantity;
}

export async function reconcileGhostfolioHoldings(
  config: NonNullable<AppConfig["ghostfolio"]>,
  holdings: NormalizedHolding[],
  comment = "Reconstructed wallet position adjustment by FinanceSync; not tax cost basis"
): Promise<number> {
  if (!config.enabled || holdings.length === 0 || !config.holdingMap) return 0;
  const grouped = new Map<string, {
    accountId: string;
    capturedAt: string;
    currency?: string;
    dataSource: string;
    decimals: number;
    quantity: bigint;
    symbol: string;
  }>();
  for (const holding of holdings) {
    const accountId = config.accountMap[holding.accountId];
    const asset = config.holdingMap[holding.symbol];
    if (!accountId || !asset) continue;
    const key = [accountId, asset.dataSource, asset.symbol].join(":");
    const group = grouped.get(key) ?? {
      accountId,
      capturedAt: holding.capturedAt,
      currency: asset.currency,
      dataSource: asset.dataSource,
      decimals: holding.atomicDecimals,
      quantity: 0n,
      symbol: asset.symbol
    };
    if (group.decimals !== holding.atomicDecimals) {
      throw new Error("Ghostfolio-Holdings mit unterschiedlichen Dezimalstellen");
    }
    group.quantity += BigInt(holding.quantityAtomic);
    if (holding.capturedAt > group.capturedAt) group.capturedAt = holding.capturedAt;
    grouped.set(key, group);
  }
  if (grouped.size === 0) return 0;

  const authToken = await authenticate(config);
  let imported = 0;
  for (const group of grouped.values()) {
    const desired = Number(group.quantity) / 10 ** group.decimals;
    const current = await currentQuantity(
      config,
      authToken,
      group.accountId,
      group.dataSource,
      group.symbol
    );
    const delta = desired - current;
    if (Math.abs(delta) < 0.5 / 10 ** group.decimals) continue;

    const symbolResponse = await fetch(
      new URL(
        `/api/v1/symbol/${encodeURIComponent(group.dataSource)}/${encodeURIComponent(group.symbol)}`,
        config.serverUrl
      ),
      {
        headers: { authorization: `Bearer ${authToken}` },
        signal: AbortSignal.timeout(30_000)
      }
    );
    if (!symbolResponse.ok) {
      throw new Error(`Ghostfolio Kursabfrage HTTP ${symbolResponse.status}`);
    }
    const symbol = await symbolResponse.json() as {
      currency?: string;
      marketPrice?: number;
    };
    if (!Number.isFinite(symbol.marketPrice) || Number(symbol.marketPrice) <= 0) {
      throw new Error("Ghostfolio lieferte keinen gültigen Marktpreis");
    }
    const importResponse = await fetch(new URL("/api/v1/import", config.serverUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        activities: [{
          accountId: group.accountId,
          comment,
          currency: group.currency ?? symbol.currency ?? "USD",
          dataSource: group.dataSource,
          date: group.capturedAt,
          fee: 0,
          quantity: Math.abs(delta),
          symbol: group.symbol,
          type: delta > 0 ? "BUY" : "SELL",
          unitPrice: symbol.marketPrice
        }]
      }),
      signal: AbortSignal.timeout(60_000)
    });
    if (!importResponse.ok) {
      throw new Error(`Ghostfolio Positionsimport HTTP ${importResponse.status}`);
    }
    const tolerance = 0.5 / 10 ** group.decimals;
    const verified = await waitForQuantity(
      config,
      authToken,
      group.accountId,
      group.dataSource,
      group.symbol,
      desired,
      tolerance
    );
    if (Math.abs(verified - desired) >= tolerance) {
      throw new Error("Ghostfolio-Position stimmt nach dem Import nicht");
    }
    imported += 1;
  }
  return imported;
}
