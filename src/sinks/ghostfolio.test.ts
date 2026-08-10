import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("Security Token wird vor dem Import gegen einen Bearer-Token getauscht", async () => {
  const secrets = mkdtempSync(join(tmpdir(), "finance-sync-secrets-"));
  writeFileSync(join(secrets, "ghostfolio-security-token"), "permanent-token\n", {
    mode: 0o600
  });
  process.env.FINANCE_SECRETS_DIR = secrets;

  const requests: Array<{ url: string; authorization?: string; body?: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization") ?? undefined,
      body: init?.body?.toString()
    });
    if (requests.length === 1) {
      return Response.json({ authToken: "temporary-bearer-token" });
    }
    return new Response(null, { status: 201 });
  };

  try {
    const { pushToGhostfolio } = await import("./ghostfolio.js");
    const imported = await pushToGhostfolio(
      {
        enabled: true,
        serverUrl: "http://Ghostfolio:3333",
        accountMap: { wallet: "ghostfolio-account" }
      },
      [
        {
          sourceId: "solana",
          sourceActivityId: "signature",
          accountId: "wallet",
          occurredAt: "2026-07-26T12:00:00.000Z",
          type: "BUY",
          symbol: "SOL",
          quantityAtomic: "1000000000",
          atomicDecimals: 9,
          amountMinor: 12345n,
          currency: "EUR",
          rawHash: "hash"
        }
      ]
    );

    assert.equal(imported, 1);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, "http://ghostfolio:3333/api/v1/auth/anonymous");
    assert.equal(requests[0].body, JSON.stringify({ accessToken: "permanent-token" }));
    assert.equal(requests[1].url, "http://ghostfolio:3333/api/v1/import");
    assert.equal(requests[1].authorization, "Bearer temporary-bearer-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("liquides und gestaktes SOL werden als eine rekonstruierte Position abgeglichen", async () => {
  const secrets = mkdtempSync(join(tmpdir(), "finance-sync-secrets-"));
  writeFileSync(join(secrets, "ghostfolio-security-token"), "permanent-token\n", {
    mode: 0o600
  });
  process.env.FINANCE_SECRETS_DIR = secrets;

  const requests: Array<{ url: string; body?: string }> = [];
  const originalFetch = globalThis.fetch;
  let detailCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, body: init?.body?.toString() });
    if (url.endsWith("/api/v1/auth/anonymous")) {
      return Response.json({ authToken: "temporary-bearer-token" });
    }
    if (url.includes("/api/v1/portfolio/details")) {
      detailCalls += 1;
      return Response.json({
        holdings: detailCalls <= 2
          ? {}
          : {
              solana: {
                quantity: 3,
                assetProfile: { dataSource: "COINGECKO", symbol: "solana" }
              }
            }
      });
    }
    if (url.endsWith("/api/v1/symbol/COINGECKO/solana")) {
      return Response.json({ currency: "USD", marketPrice: 150 });
    }
    if (url.endsWith("/api/v1/import")) {
      return new Response(null, { status: 201 });
    }
    return new Response(null, { status: 404 });
  };

  try {
    const { reconcileGhostfolioHoldings } = await import("./ghostfolio.js");
    const imported = await reconcileGhostfolioHoldings(
      {
        enabled: true,
        serverUrl: "http://Ghostfolio:3333",
        accountMap: { wallet: "ghostfolio-account" },
        holdingMap: {
          SOL: { dataSource: "COINGECKO", symbol: "solana", currency: "USD" },
          "SOL-STAKED": {
            dataSource: "COINGECKO",
            symbol: "solana",
            currency: "USD"
          }
        }
      },
      [
        {
          sourceId: "solana",
          accountId: "wallet",
          capturedAt: "2026-07-27T12:00:00.000Z",
          symbol: "SOL",
          quantityAtomic: "1000000000",
          atomicDecimals: 9,
          rawHash: "one"
        },
        {
          sourceId: "solana",
          accountId: "wallet",
          capturedAt: "2026-07-27T12:00:00.000Z",
          symbol: "SOL-STAKED",
          quantityAtomic: "2000000000",
          atomicDecimals: 9,
          rawHash: "two"
        }
      ]
    );

    assert.equal(imported, 1);
    const importRequest = requests.find((request) =>
      request.url.endsWith("/api/v1/import")
    );
    const body = JSON.parse(importRequest?.body ?? "{}");
    assert.deepEqual(body.activities[0], {
      accountId: "ghostfolio-account",
      comment: "Reconstructed wallet position adjustment by FinanceSync; not tax cost basis",
      currency: "USD",
      dataSource: "COINGECKO",
      date: "2026-07-27T12:00:00.000Z",
      fee: 0,
      quantity: 3,
      symbol: "solana",
      type: "BUY",
      unitPrice: 150
    });
    assert.equal(detailCalls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("vollständig verkaufte Positionen werden in einem kompletten Depotstand auf null gesetzt", async () => {
  const secrets = mkdtempSync(join(tmpdir(), "finance-sync-secrets-"));
  writeFileSync(join(secrets, "ghostfolio-security-token"), "permanent-token\n", {
    mode: 0o600
  });
  process.env.FINANCE_SECRETS_DIR = secrets;

  const requests: Array<{ url: string; body?: string }> = [];
  const originalFetch = globalThis.fetch;
  let filteredDetailCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, body: init?.body?.toString() });
    if (url.endsWith("/api/v1/auth/anonymous")) {
      return Response.json({ authToken: "temporary-bearer-token" });
    }
    if (url.includes("/api/v1/portfolio/details")) {
      const parsed = new URL(url);
      if (!parsed.searchParams.has("symbol")) {
        return Response.json({
          holdings: {
            sap: {
              quantity: 12,
              assetProfile: { dataSource: "YAHOO", symbol: "SAP.DE" }
            }
          }
        });
      }
      filteredDetailCalls += 1;
      return Response.json({
        holdings: filteredDetailCalls === 1
          ? {
              sap: {
                quantity: 12,
                assetProfile: { dataSource: "YAHOO", symbol: "SAP.DE" }
              }
            }
          : {}
      });
    }
    if (url.endsWith("/api/v1/symbol/YAHOO/SAP.DE")) {
      return Response.json({ currency: "EUR", marketPrice: 190 });
    }
    if (url.endsWith("/api/v1/import")) {
      return new Response(null, { status: 201 });
    }
    return new Response(null, { status: 404 });
  };

  try {
    const { reconcileGhostfolioHoldings } = await import("./ghostfolio.js");
    const imported = await reconcileGhostfolioHoldings(
      {
        enabled: true,
        serverUrl: "http://Ghostfolio:3333",
        accountMap: { depot: "ghostfolio-account" },
        holdingMap: {
          DE0007164600: { dataSource: "YAHOO", symbol: "SAP.DE", currency: "EUR" }
        }
      },
      [],
      "DKB adjustment",
      [{ accountId: "depot", capturedAt: "2026-08-10T12:00:00.000Z" }]
    );

    assert.equal(imported, 1);
    const importRequest = requests.find((request) =>
      request.url.endsWith("/api/v1/import")
    );
    const body = JSON.parse(importRequest?.body ?? "{}");
    assert.deepEqual(body.activities[0], {
      accountId: "ghostfolio-account",
      comment: "DKB adjustment",
      currency: "EUR",
      dataSource: "YAHOO",
      date: "2026-08-10T12:00:00.000Z",
      fee: 0,
      quantity: 12,
      symbol: "SAP.DE",
      type: "SELL",
      unitPrice: 190
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
