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
