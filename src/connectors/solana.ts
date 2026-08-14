import { readSecret } from "../config.js";
import { sha256 } from "../archive.js";
import type { ImportBundle, SourceConfig } from "../types.js";

interface RpcResponse<T> {
  result?: T;
  error?: { message?: string };
}

interface HistoryTransaction {
  signature?: string;
  blockTime?: number | null;
  transaction?: {
    signatures?: string[];
    message?: {
      accountKeys?: Array<string | { pubkey?: string }>;
    };
  };
  meta?: {
    fee?: number;
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: Array<{
      owner?: string;
      mint: string;
      uiTokenAmount: { amount: string; decimals: number };
    }>;
    postTokenBalances?: Array<{
      owner?: string;
      mint: string;
      uiTokenAmount: { amount: string; decimals: number };
    }>;
    rewards?: Array<{
      pubkey?: string;
      lamports?: number;
      rewardType?: string;
    }>;
  };
}

interface HistoryPage {
  data: HistoryTransaction[];
  paginationToken?: string | null;
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(45_000)
  });
  if (!response.ok) throw new Error(`Solana RPC HTTP ${response.status}`);
  const json = await response.json() as RpcResponse<T>;
  if (json.error) throw new Error(json.error.message ?? "Solana RPC Fehler");
  if (json.result === undefined) throw new Error("Solana RPC lieferte kein Ergebnis");
  return json.result;
}

async function fetchHistory(
  rpcUrl: string,
  wallet: string,
  source: SourceConfig
): Promise<HistoryPage> {
  const data: HistoryTransaction[] = [];
  const seenTokens = new Set<string>();
  const maxPages = Number(source.settings?.historyMaxPages ?? 100);
  const limit = Math.min(Number(source.settings?.historyLimit ?? 100), 100);
  let paginationToken: string | undefined;
  let pages = 0;
  do {
    const page = await rpc<HistoryPage>(
      rpcUrl,
      "getTransactionsForAddress",
      [
        wallet,
        {
          transactionDetails: "full",
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 0,
          sortOrder: "desc",
          limit,
          filters: { status: "succeeded", tokenAccounts: "balanceChanged" },
          ...(paginationToken ? { paginationToken } : {})
        }
      ]
    );
    data.push(...page.data);
    pages += 1;
    const next = page.paginationToken ?? undefined;
    if (!next) return { data };
    if (seenTokens.has(next)) {
      throw new Error("Solana-Historie lieferte einen wiederholten Seitencursor");
    }
    seenTokens.add(next);
    paginationToken = next;
  } while (pages < maxPages);
  throw new Error(`Solana-Historie überschreitet ${maxPages} Seiten`);
}

export async function fetchSolana(source: SourceConfig): Promise<ImportBundle> {
  const apiKey = readSecret("helius-api-key");
  if (!apiKey) throw new Error("Secret helius-api-key fehlt");
  const wallets = (source.settings?.wallets as string[] | undefined) ?? [];
  if (wallets.length === 0) throw new Error("Keine Solana-Wallet in settings.wallets konfiguriert");
  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey)}`;
  const capturedAt = new Date().toISOString();
  const raw: Record<string, unknown> = { capturedAt, wallets: {} };
  const balances: ImportBundle["balances"] = [];
  const holdings: ImportBundle["holdings"] = [];
  const activities: NonNullable<ImportBundle["activities"]> = [];

  for (const wallet of wallets) {
    const [native, tokenAccounts, token2022Accounts, stakeAccounts, history] = await Promise.all([
      rpc<{ value: number }>(rpcUrl, "getBalance", [wallet, { commitment: "finalized" }]),
      rpc<{ value: Array<{ pubkey: string; account: { data: { parsed: { info: {
        mint: string;
        tokenAmount: { amount: string; decimals: number; uiAmountString?: string };
      } } } } }> }>(
        rpcUrl,
        "getTokenAccountsByOwner",
        [wallet, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }]
      ),
      rpc<{ value: Array<{ pubkey: string; account: { data: { parsed: { info: {
        mint: string;
        tokenAmount: { amount: string; decimals: number; uiAmountString?: string };
      } } } } }> }>(
        rpcUrl,
        "getTokenAccountsByOwner",
        [wallet, { programId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" }, { encoding: "jsonParsed" }]
      ),
      rpc<Array<{ pubkey: string; account: { lamports: number } }>>(
        rpcUrl,
        "getProgramAccounts",
        [
          "Stake11111111111111111111111111111111111111",
          {
            encoding: "base64",
            filters: [{ memcmp: { offset: 44, bytes: wallet } }]
          }
        ]
      ).catch(() => []),
      fetchHistory(rpcUrl, wallet, source)
    ]);
    const walletRaw = { native, tokenAccounts, token2022Accounts, stakeAccounts, history };
    (raw.wallets as Record<string, unknown>)[wallet] = walletRaw;
    const rawHash = sha256(JSON.stringify(walletRaw));
    balances.push({
      sourceId: source.id,
      accountId: wallet,
      capturedAt,
      amountMinor: BigInt(native.value),
      currency: "LAMPORT",
      owner: source.owners?.join(", "),
      rawHash
    });
    holdings.push({
      sourceId: source.id,
      accountId: wallet,
      capturedAt,
      symbol: "SOL",
      name: "Solana",
      quantityAtomic: String(native.value),
      atomicDecimals: 9,
      owner: source.owners?.join(", "),
      rawHash
    });
    for (const token of [...tokenAccounts.value, ...token2022Accounts.value]) {
      const info = token.account.data.parsed.info;
      holdings.push({
        sourceId: source.id,
        accountId: wallet,
        capturedAt,
        symbol: info.mint,
        quantityAtomic: info.tokenAmount.amount,
        atomicDecimals: info.tokenAmount.decimals,
        owner: source.owners?.join(", "),
        rawHash
      });
    }
    const stakedLamports = stakeAccounts.reduce(
      (sum, account) => sum + BigInt(account.account.lamports), 0n
    );
    if (stakedLamports > 0n) {
      holdings.push({
        sourceId: source.id,
        accountId: wallet,
        capturedAt,
        symbol: "SOL-STAKED",
        name: "Native staked SOL",
        quantityAtomic: stakedLamports.toString(),
        atomicDecimals: 9,
        owner: source.owners?.join(", "),
        rawHash
      });
    }
    for (const item of history.data) {
      const signature = item.signature ?? item.transaction?.signatures?.[0];
      const occurredAt = item.blockTime
        ? new Date(item.blockTime * 1000).toISOString()
        : capturedAt;
      if (!signature) continue;
      for (const reward of item.meta?.rewards ?? []) {
        if (reward.rewardType !== "staking" || !Number.isSafeInteger(reward.lamports) || reward.lamports === 0) continue;
        activities.push({
          sourceId: source.id,
          sourceActivityId: `${signature}:staking:${reward.pubkey ?? "unknown"}`,
          accountId: reward.pubkey ?? wallet,
          occurredAt,
          type: "STAKING_REWARD",
          symbol: "SOL",
          quantityAtomic: String(reward.lamports),
          atomicDecimals: 9,
          note: "On-chain staking reward",
          rawHash
        });
      }
      const keys = item.transaction?.message?.accountKeys?.map(
        (key) => typeof key === "string" ? key : key.pubkey ?? ""
      ) ?? [];
      const index = keys.indexOf(wallet);
      if (
        index >= 0
        && item.meta?.preBalances?.[index] !== undefined
        && item.meta?.postBalances?.[index] !== undefined
      ) {
        const delta = BigInt(item.meta.postBalances[index] - item.meta.preBalances[index]);
        if (delta !== 0n) {
          activities.push({
            sourceId: source.id,
            sourceActivityId: `${signature}:SOL`,
            accountId: wallet,
            occurredAt,
            type: "TRANSFER_NET",
            symbol: "SOL",
            quantityAtomic: delta.toString(),
            atomicDecimals: 9,
            note: `Solana signature ${signature}`,
            rawHash
          });
        }
      }
      const tokenState = new Map<string, { pre: bigint; post: bigint; decimals: number }>();
      for (const balance of item.meta?.preTokenBalances ?? []) {
        if (balance.owner !== wallet) continue;
        tokenState.set(balance.mint, {
          pre: BigInt(balance.uiTokenAmount.amount),
          post: 0n,
          decimals: balance.uiTokenAmount.decimals
        });
      }
      for (const balance of item.meta?.postTokenBalances ?? []) {
        if (balance.owner !== wallet) continue;
        const state = tokenState.get(balance.mint) ?? {
          pre: 0n,
          post: 0n,
          decimals: balance.uiTokenAmount.decimals
        };
        state.post = BigInt(balance.uiTokenAmount.amount);
        tokenState.set(balance.mint, state);
      }
      for (const [mint, state] of tokenState) {
        const delta = state.post - state.pre;
        if (delta === 0n) continue;
        activities.push({
          sourceId: source.id,
          sourceActivityId: `${signature}:${mint}`,
          accountId: wallet,
          occurredAt,
          type: "TOKEN_TRANSFER_NET",
          symbol: mint,
          quantityAtomic: delta.toString(),
          atomicDecimals: state.decimals,
          note: `Solana signature ${signature}`,
          rawHash
        });
      }
    }
  }
  return { raw, balances, holdings, activities };
}
