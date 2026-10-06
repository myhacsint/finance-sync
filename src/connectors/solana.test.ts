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
              postBalances: [secondPage ? 300 : 100],
              ...(secondPage ? { rewards: [{ pubkey: "Stake111", lamports: 7, rewardType: "staking" }] } : {})
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
    assert.equal(bundle.activities?.length, 3);
    const reward = bundle.activities?.find((activity) => activity.type === "STAKING_REWARD");
    assert.equal(reward?.symbol, "SOL");
    assert.equal(reward?.quantityAtomic, "7");
    assert.equal(reward?.atomicDecimals, 9);
    const raw = bundle.raw as {
      wallets: Record<string, { history: { data: unknown[] } }>;
    };
    assert.equal(raw.wallets[wallet].history.data.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function stakeFetchMock(wallet: string, stakeResponses: Array<"error" | number>) {
  let stakeCalls = 0;
  const fetchMock: typeof fetch = async (_input, init) => {
    const body = JSON.parse(init?.body?.toString() ?? "{}");
    if (body.method === "getBalance") {
      return Response.json({ jsonrpc: "2.0", id: 1, result: { value: 300 } });
    }
    if (body.method === "getTokenAccountsByOwner") {
      return Response.json({ jsonrpc: "2.0", id: 1, result: { value: [] } });
    }
    if (body.method === "getProgramAccounts") {
      const next = stakeResponses[Math.min(stakeCalls, stakeResponses.length - 1)];
      stakeCalls += 1;
      if (next === "error") return new Response(null, { status: 429 });
      return Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: [{ pubkey: "Stake111", account: { lamports: next } }]
      });
    }
    if (body.method === "getTransactionsForAddress") {
      return Response.json({ jsonrpc: "2.0", id: 1, result: { data: [], paginationToken: null } });
    }
    return new Response(null, { status: 500 });
  };
  return { fetchMock, calls: () => stakeCalls, wallet };
}

async function withSolanaMock<T>(
  stakeResponses: Array<"error" | number>,
  run: (fetchSolana: typeof import("./solana.js").fetchSolana, wallet: string) => Promise<T>
): Promise<{ result: T; stakeCalls: number }> {
  const secrets = mkdtempSync(join(tmpdir(), "finance-sync-solana-secrets-"));
  writeFileSync(join(secrets, "helius-api-key"), "helius-token\n", { mode: 0o600 });
  process.env.FINANCE_SECRETS_DIR = secrets;
  const wallet = "Wallet11111111111111111111111111111111111";
  const mock = stakeFetchMock(wallet, stakeResponses);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock.fetchMock;
  try {
    const { fetchSolana } = await import("./solana.js");
    const result = await run(fetchSolana, wallet);
    return { result, stakeCalls: mock.calls() };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const solanaSource = (wallet: string) => ({
  id: "solana",
  kind: "solana" as const,
  enabled: true,
  owners: ["Erik"],
  settings: { wallets: [wallet] }
});

test("Fehlgeschlagener Stake-Abruf bricht den Solana-Lauf ab statt 0 SOL zu melden", async () => {
  const { result, stakeCalls } = await withSolanaMock(["error"], async (fetchSolana, wallet) =>
    fetchSolana(solanaSource(wallet)).then(
      () => "resolved",
      (error: Error) => error.message
    )
  );
  assert.match(result, /Solana-Stake-Konten nicht abrufbar/);
  assert.equal(stakeCalls, 2);
});

test("Einmaliger Stake-Fehler wird mit einem zweiten Versuch abgefangen", async () => {
  const { result, stakeCalls } = await withSolanaMock(["error", 5_000_000_000], async (fetchSolana, wallet) =>
    fetchSolana(solanaSource(wallet))
  );
  assert.equal(stakeCalls, 2);
  const staked = result.holdings?.find((holding) => holding.symbol === "SOL-STAKED");
  assert.equal(staked?.quantityAtomic, "5000000000");
});
