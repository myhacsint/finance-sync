import { createSign, randomBytes } from "node:crypto";
import { readSecret } from "../config.js";
import { sha256 } from "../archive.js";
import type { ImportBundle, SourceConfig } from "../types.js";

interface EnableBankingAccount {
  uid?: string;
  account_id?: { iban?: string };
  name?: string;
  currency?: string;
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

export async function fetchEnableBanking(
  source: SourceConfig,
  storedSessionId?: string
): Promise<ImportBundle> {
  const sessionId = storedSessionId ?? String(source.settings?.sessionId ?? "");
  if (!sessionId) throw new Error("settings.sessionId fehlt");
  const accountsResponse = await api<{ accounts?: EnableBankingAccount[] }>(
    source, `/sessions/${encodeURIComponent(sessionId)}`
  );
  const accounts = accountsResponse.accounts ?? [];
  const raw: Record<string, unknown> = { sessionId, accounts, transactions: {} };
  const transactions: NonNullable<ImportBundle["transactions"]> = [];

  for (const account of accounts) {
    const accountId = account.uid ?? account.account_id?.iban;
    if (!accountId) continue;
    const result = await api<{ transactions?: EnableBankingTransaction[] }>(
      source, `/accounts/${encodeURIComponent(accountId)}/transactions`
    );
    (raw.transactions as Record<string, unknown>)[accountId] = result;
    const rawHash = sha256(JSON.stringify(result));
    for (const tx of result.transactions ?? []) {
      const amount = tx.transaction_amount?.amount;
      const date = tx.booking_date ?? tx.value_date;
      if (!amount || !date) continue;
      const remittance = Array.isArray(tx.remittance_information)
        ? tx.remittance_information.join(" ")
        : tx.remittance_information;
      transactions.push({
        sourceId: source.id,
        sourceTransactionId: tx.transaction_id ?? tx.entry_reference,
        accountId,
        bookedAt: date,
        valueAt: tx.value_date,
        amountMinor: amountToMinor(amount),
        currency: tx.transaction_amount?.currency ?? account.currency ?? "EUR",
        payee: tx.creditor?.name ?? tx.debtor?.name,
        memo: remittance,
        owner: source.owners?.join(", "),
        rawHash
      });
    }
  }
  return { raw, transactions };
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
