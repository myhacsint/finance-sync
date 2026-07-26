import { createSign, randomBytes } from "node:crypto";
import { readSecret } from "../config.js";
import { sha256 } from "../archive.js";
import type { ImportBundle, SourceConfig } from "../types.js";

interface EnableBankingAccount {
  uid?: string;
  account_id?: { iban?: string };
  name?: string;
  currency?: string;
  identification_hash?: string;
  identification_hashes?: string[];
}

interface EnableBankingSession {
  status?: string;
  accounts?: Array<string | EnableBankingAccount>;
  accounts_data?: Array<{
    uid: string;
    identification_hash?: string;
    identification_hashes?: string[];
  }>;
  access?: { valid_until?: string };
}

interface EnableBankingTransaction {
  transaction_id?: string;
  entry_reference?: string;
  booking_date?: string;
  value_date?: string;
  transaction_amount?: { amount?: string; currency?: string };
  creditor?: { name?: string };
  debtor?: { name?: string };
  remittance_information?: string[] | string;
  credit_debit_indicator?: "CRDT" | "DBIT";
}

interface EnableBankingTransactions {
  transactions?: EnableBankingTransaction[];
  continuation_key?: string;
}

interface EnableBankingBalances {
  balances?: Array<{
    name?: string;
    balance_type?: string;
    reference_date?: string;
    last_change_date_time?: string;
    balance_amount?: { amount?: string; currency?: string };
  }>;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function jwt(source: SourceConfig): string {
  const privateKey = readSecret("enable-banking-private-key.pem");
  const applicationId = String(source.settings?.applicationId ?? "");
  if (!privateKey) throw new Error("Secret enable-banking-private-key.pem fehlt");
  if (!applicationId) throw new Error("settings.applicationId fehlt");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: applicationId }));
  const claims = base64url(JSON.stringify({
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return `${unsigned}.${base64url(signature)}`;
}

async function api<T>(
  source: SourceConfig,
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const baseUrl = String(source.settings?.baseUrl ?? "https://api.enablebanking.com");
  const response = await fetch(new URL(path, baseUrl), {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Bearer ${jwt(source)}`,
      accept: "application/json",
      "content-type": "application/json"
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(45_000)
  });
  if (!response.ok) throw new Error(`Enable Banking HTTP ${response.status} für ${path}`);
  return response.json() as Promise<T>;
}

function amountToMinor(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new Error(`Ungültiger PSD2-Betrag: ${value}`);
  const fraction = (match[3] ?? "").padEnd(2, "0").slice(0, 2);
  const minor = BigInt(match[2]) * 100n + BigInt(fraction || "0");
  return match[1] ? -minor : minor;
}

function signedAmountToMinor(
  value: string,
  indicator?: EnableBankingTransaction["credit_debit_indicator"]
): bigint {
  const amount = amountToMinor(value);
  if (indicator === "DBIT") return amount > 0n ? -amount : amount;
  if (indicator === "CRDT") return amount < 0n ? -amount : amount;
  return amount;
}

function ownerForAccount(
  source: SourceConfig,
  accountIds: string[]
): string | undefined {
  const ownersByAccount =
    source.settings?.ownersByAccount as Record<string, string[]> | undefined;
  for (const id of accountIds) {
    const owners = ownersByAccount?.[id];
    if (owners?.length) return owners.join(", ");
  }
  return source.owners?.join(", ");
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function transactionPeriods(
  dateFrom: string,
  dateTo: string,
  periodDays: number
): Array<{ dateFrom?: string; dateTo?: string }> {
  if (!dateFrom) return [{}];
  const first = new Date(`${dateFrom}T00:00:00.000Z`);
  const last = new Date(`${dateTo}T00:00:00.000Z`);
  if (
    Number.isNaN(first.getTime())
    || Number.isNaN(last.getTime())
    || first > last
    || periodDays < 1
  ) {
    throw new Error("Ungültiger Enable-Banking-Zeitraum");
  }
  const periods: Array<{ dateFrom: string; dateTo: string }> = [];
  for (let start = first; start <= last;) {
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + periodDays - 1);
    if (end > last) end.setTime(last.getTime());
    periods.push({ dateFrom: formatDate(start), dateTo: formatDate(end) });
    start = new Date(end);
    start.setUTCDate(start.getUTCDate() + 1);
  }
  return periods;
}

export async function fetchEnableBanking(
  source: SourceConfig,
  storedSessionId?: string
): Promise<ImportBundle> {
  const sessionId = storedSessionId ?? String(source.settings?.sessionId ?? "");
  if (!sessionId) throw new Error("settings.sessionId fehlt");
  const session = await api<EnableBankingSession>(
    source, `/sessions/${encodeURIComponent(sessionId)}`
  );
  if (session.status && session.status !== "AUTHORIZED") {
    throw new Error(`Enable-Banking-Sitzung ist ${session.status}`);
  }
  const sessionAccounts = session.accounts ?? [];
  const sessionData = new Map(
    (session.accounts_data ?? []).map((account) => [account.uid, account])
  );
  const allowedAccountIds =
    (source.settings?.accountIds as string[] | undefined) ?? [];
  const raw: Record<string, unknown> = {
    session: {
      status: session.status,
      access: session.access,
      accounts_data: session.accounts_data
    },
    accounts: {},
    balances: {},
    transactions: {}
  };
  const transactions: NonNullable<ImportBundle["transactions"]> = [];
  const balances: NonNullable<ImportBundle["balances"]> = [];

  for (const sessionAccount of sessionAccounts) {
    const uid = typeof sessionAccount === "string"
      ? sessionAccount
      : sessionAccount.uid;
    if (!uid) continue;
    const account = typeof sessionAccount === "string"
      ? await api<EnableBankingAccount>(
        source, `/accounts/${encodeURIComponent(uid)}/details`
      )
      : sessionAccount;
    const metadata = sessionData.get(uid);
    const stableAccountId =
      account.identification_hash
      ?? metadata?.identification_hash
      ?? account.account_id?.iban
      ?? uid;
    const accountAliases = Array.from(new Set([
      stableAccountId,
      uid,
      account.account_id?.iban,
      ...(account.identification_hashes ?? []),
      ...(metadata?.identification_hashes ?? [])
    ].filter((value): value is string => Boolean(value))));
    if (
      allowedAccountIds.length > 0
      && !accountAliases.some((id) => allowedAccountIds.includes(id))
    ) {
      continue;
    }
    const owner = ownerForAccount(source, accountAliases);
    (raw.accounts as Record<string, unknown>)[stableAccountId] = account;

    const balanceResult = await api<EnableBankingBalances>(
      source, `/accounts/${encodeURIComponent(uid)}/balances`
    );
    (raw.balances as Record<string, unknown>)[stableAccountId] = balanceResult;
    const preferredBalance =
      balanceResult.balances?.find((item) => item.balance_type === "CLAV")
      ?? balanceResult.balances?.find((item) => item.balance_type === "ITAV")
      ?? balanceResult.balances?.[0];
    if (preferredBalance?.balance_amount?.amount) {
      balances.push({
        sourceId: source.id,
        accountId: stableAccountId,
        capturedAt:
          preferredBalance.last_change_date_time
          ?? preferredBalance.reference_date
          ?? new Date().toISOString(),
        amountMinor: amountToMinor(preferredBalance.balance_amount.amount),
        currency:
          preferredBalance.balance_amount.currency
          ?? account.currency
          ?? "EUR",
        owner,
        rawHash: sha256(JSON.stringify(balanceResult))
      });
    }

    const pages: EnableBankingTransactions[] = [];
    const maximumPages = Number(source.settings?.maximumPages ?? 50);
    const dateFrom = String(source.settings?.dateFrom ?? "");
    const dateTo = String(
      source.settings?.dateTo ?? new Date().toISOString().slice(0, 10)
    );
    const periodDays = Number(source.settings?.periodDays ?? 90);
    const strategy = String(source.settings?.strategy ?? "default");
    const periods = strategy === "longest"
      ? [{ dateFrom }]
      : transactionPeriods(dateFrom, dateTo, periodDays);
    for (const period of periods) {
      let continuationKey: string | undefined;
      let periodPages = 0;
      do {
        const query = new URLSearchParams({ transaction_status: "BOOK" });
        if (strategy === "longest") query.set("strategy", "longest");
        if (period.dateFrom) query.set("date_from", period.dateFrom);
        if (strategy !== "longest" && period.dateTo) {
          query.set("date_to", period.dateTo);
        }
        if (continuationKey) query.set("continuation_key", continuationKey);
        const result = await api<EnableBankingTransactions>(
          source,
          `/accounts/${encodeURIComponent(uid)}/transactions?${query.toString()}`
        );
        pages.push(result);
        periodPages += 1;
        continuationKey = result.continuation_key;
      } while (continuationKey && periodPages < maximumPages);
    }
    (raw.transactions as Record<string, unknown>)[stableAccountId] = pages;
    const rawHash = sha256(JSON.stringify(pages));
    for (const tx of pages.flatMap((page) => page.transactions ?? [])) {
      const amount = tx.transaction_amount?.amount;
      const date = tx.booking_date ?? tx.value_date;
      if (!amount || !date) continue;
      const remittance = Array.isArray(tx.remittance_information)
        ? tx.remittance_information.join(" ")
        : tx.remittance_information;
      transactions.push({
        sourceId: source.id,
        sourceTransactionId: `${stableAccountId}:${
          tx.transaction_id ?? tx.entry_reference ?? sha256(JSON.stringify(tx))
        }`,
        accountId: stableAccountId,
        bookedAt: date,
        valueAt: tx.value_date,
        amountMinor: signedAmountToMinor(
          amount,
          tx.credit_debit_indicator
        ),
        currency: tx.transaction_amount?.currency ?? account.currency ?? "EUR",
        payee: tx.credit_debit_indicator === "CRDT"
          ? tx.debtor?.name ?? tx.creditor?.name
          : tx.creditor?.name ?? tx.debtor?.name,
        memo: remittance,
        owner,
        rawHash
      });
    }
  }
  return { raw, transactions, balances };
}

export async function startAuthorization(
  source: SourceConfig,
  redirectUrl: string
): Promise<{ url: string; state: string; validUntil: string }> {
  const aspspName = String(source.settings?.aspspName ?? "");
  const country = String(source.settings?.country ?? "DE");
  if (!aspspName) throw new Error("settings.aspspName fehlt");
  const state = randomBytes(24).toString("hex");
  const validUntil = new Date(Date.now() + 179 * 86_400_000).toISOString();
  const response = await api<{ url: string }>(source, "/auth", {
    method: "POST",
    body: {
      access: {
        valid_until: validUntil,
        balances: true,
        transactions: true
      },
      aspsp: { name: aspspName, country },
      psu_type: "personal",
      redirect_url: redirectUrl,
      state
    }
  });
  return { url: response.url, state, validUntil };
}

export async function completeAuthorization(
  source: SourceConfig,
  code: string
): Promise<{ sessionId: string }> {
  const response = await api<{ session_id: string }>(source, "/sessions", {
    method: "POST",
    body: { code }
  });
  return { sessionId: response.session_id };
}
