import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("Solana-Historie wird bis zum letzten Seitencursor gelesen", async () => {
  const secrets = mkdtempSync(join(tmpdir(), "finance-sync-solana-secrets-"));
  writeFileSync(join(secrets, "helius-api-key"), "helius-token\n", {
    mode: 0o600
  });
  process.env.FINANCE_SECRETS_DIR = secrets;

  const wallet = "Wallet11111111111111111111111111111111111";
  const originalFetch = globalThis.fetch;
  let historyCalls = 0;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(init?.body?.toString() ?? "{}");
    if (body.method === "getBalance") {
      return Response.json({ jsonrpc: "2.0", id: 1, result: { value: 300 } });
    }
    if (body.method === "getTokenAccountsByOwner") {
      return Response.json({ jsonrpc: "2.0", id: 1, result: { value: [] } });
    }
    if (body.method === "getProgramAccounts") {
      return Response.json({ jsonrpc: "2.0", id: 1, result: [] });
    }
    if (body.method === "getTransactionsForAddress") {
      historyCalls += 1;
      const options = body.params[1];
      const secondPage = options.paginationToken === "next-page";
      return Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: {
          data: [{
            signature: secondPage ? "second" : "first",
            blockTime: secondPage ? 2 : 1,
            transaction: { message: { accountKeys: [wallet] } },
            meta: {
              preBalances: [secondPage ? 100 : 0],
              postBalances: [secondPage ? 300 : 100]
            }
          }],
          paginationToken: secondPage ? null : "next-page"
        }
      });
    }
    return new Response(null, { status: 500 });
  };

  try {
    const { fetchSolana } = await import("./solana.js");
    const bundle = await fetchSolana({
      id: "solana",
      kind: "solana",
      enabled: true,
      owners: ["Erik"],
      settings: { wallets: [wallet] }
    });
    assert.equal(historyCalls, 2);
    assert.equal(bundle.activities?.length, 2);
    const raw = bundle.raw as {
      wallets: Record<string, { history: { data: unknown[] } }>;
    };
    assert.equal(raw.wallets[wallet].history.data.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
