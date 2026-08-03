import { spawn } from "node:child_process";
import { join } from "node:path";
import { sha256 } from "../archive.js";
import { readSecret } from "../config.js";
import type {
  ImportBundle,
  NormalizedBalance,
  NormalizedHolding,
  SourceConfig,
  SyncResult
} from "../types.js";

const DKB_SERVER_URL = "https://fints.dkb.de/fints";
const DEFAULT_BANK_ID = "12030000";
const DEFAULT_BIC = "BYLADEM1001";
const DEFAULT_TAN_MECHANISM = "940";

interface DkbAccountConfig {
  accountId: string;
  accountNumber: string;
  owner?: string;
  subaccount?: string;
}

interface DkbHelperPosition {
  isin: string;
  name?: string;
  quantity: string;
  price?: string;
  priceCurrency?: string;
  marketValue?: string;
  marketValueCurrency?: string;
  valuationDate?: string;
}

interface DkbHelperPortfolio {
  accountId: string;
  capturedAt: string;
  rawMt535: string[];
  positions: DkbHelperPosition[];
}

export interface DkbHelperOutput {
  state: "READY" | "SUCCESS" | "WAITING_FOR_USER" | "ERROR";
  message: string;
  challenge?: string;
  decoupled?: boolean;
  continuation?: Record<string, unknown>;
  clientData?: string;
  portfolios?: DkbHelperPortfolio[];
  libraryVersion?: string;
}

interface DkbHelperInput {
  action: "preflight" | "fetch" | "continue";
  productId: string;
  userId?: string;
  pin?: string;
  tan?: string;
  clientData?: string;
  continuation?: Record<string, unknown>;
  config: {
    bankId: string;
    bic: string;
    productVersion: string;
    serverUrl: string;
    tanMechanism: string;
    tanMedium?: string;
    accounts: DkbAccountConfig[];
  };
}

export type DkbFintsOutcome =
  | { state: "SUCCESS"; message: string; bundle: ImportBundle; clientData?: string }
  | {
      state: "WAITING_FOR_USER";
      message: string;
      challenge?: string;
      decoupled: boolean;
      continuation: Record<string, unknown>;
    };

export type DkbFintsRunner = (input: DkbHelperInput) => Promise<DkbHelperOutput>;

function sourceAccounts(source: SourceConfig): DkbAccountConfig[] {
  const raw = source.settings?.accounts;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("DKB-FinTS settings.accounts fehlt");
  }
  const accounts = raw.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("DKB-FinTS enthält ein ungültiges Depot");
    }
    const value = item as Record<string, unknown>;
    const accountId = String(value.accountId ?? "").trim();
    const accountNumber = String(value.accountNumber ?? "").trim();
    if (!accountId || !accountNumber) {
      throw new Error("DKB-FinTS Depot benötigt accountId und accountNumber");
    }
    if (!/^[-a-zA-Z0-9_.]+$/.test(accountId) || !/^\d{5,20}$/.test(accountNumber)) {
      throw new Error("DKB-FinTS Depotkennung ist ungültig");
    }
    return {
      accountId,
      accountNumber,
      owner: String(value.owner ?? source.owners?.join(", ") ?? "").trim() || undefined,
      subaccount: String(value.subaccount ?? "").trim() || undefined
    };
  });
  if (new Set(accounts.map((account) => account.accountId)).size !== accounts.length) {
    throw new Error("DKB-FinTS accountId ist nicht eindeutig");
  }
  return accounts;
}

function helperConfig(source: SourceConfig): DkbHelperInput["config"] {
  const serverUrl = String(source.settings?.serverUrl ?? DKB_SERVER_URL);
  if (serverUrl !== DKB_SERVER_URL) {
    throw new Error("DKB-FinTS Server muss der freigegebene DKB-Endpunkt sein");
  }
  const bankId = String(source.settings?.bankId ?? DEFAULT_BANK_ID);
  if (!/^\d{8}$/.test(bankId)) throw new Error("DKB-FinTS Bankleitzahl ist ungültig");
  const bic = String(source.settings?.bic ?? DEFAULT_BIC).toUpperCase();
  if (!/^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$/.test(bic) || bic.slice(4, 6) !== "DE") {
    throw new Error("DKB-FinTS BIC ist ungültig");
  }
  return {
    bankId,
    bic,
    productVersion: String(source.settings?.productVersion ?? "0.6.0").slice(0, 5),
    serverUrl,
    tanMechanism: String(source.settings?.tanMechanism ?? DEFAULT_TAN_MECHANISM),
    tanMedium: String(source.settings?.tanMedium ?? "").trim() || undefined,
    accounts: sourceAccounts(source)
  };
}

export function validProductId(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9]{25}$/.test(value));
}

function decimalParts(value: string): { atomic: string; decimals: number } {
  const match = /^([+-]?)(\d+)(?:[.,](\d+))?$/.exec(value.trim());
  if (!match) throw new Error("DKB-FinTS lieferte eine ungültige Dezimalzahl");
  const fraction = match[3] ?? "";
  const digits = `${match[2]}${fraction}`.replace(/^0+(?=\d)/, "");
  return {
    atomic: `${match[1] === "-" ? "-" : ""}${digits}`,
    decimals: fraction.length
  };
}

function moneyMinor(value: string): bigint {
  const parts = decimalParts(value);
  if (parts.decimals > 2) {
    throw new Error("DKB-FinTS Kurswert hat mehr als zwei Nachkommastellen");
  }
  const sign = parts.atomic.startsWith("-") ? -1n : 1n;
  const digits = parts.atomic.replace(/^-/, "");
  return sign * BigInt(digits) * 10n ** BigInt(2 - parts.decimals);
}

export function normalizeDkbFintsBundle(
  source: SourceConfig,
  output: DkbHelperOutput
): ImportBundle {
  const configured = new Map(helperConfig(source).accounts.map((account) => [account.accountId, account]));
  const portfolios = output.portfolios ?? [];
  if (portfolios.length === 0) throw new Error("DKB-FinTS lieferte keinen Depotbestand");
  const holdings: NormalizedHolding[] = [];
  const balances: NormalizedBalance[] = [];
  for (const portfolio of portfolios) {
    const account = configured.get(portfolio.accountId);
    if (!account) throw new Error("DKB-FinTS lieferte ein nicht konfiguriertes Depot");
    const rawHash = sha256(JSON.stringify(portfolio));
    const values: Array<{ amount: bigint; currency: string }> = [];
    for (const position of portfolio.positions) {
      if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(position.isin)) {
        throw new Error("DKB-FinTS Position enthält keine gültige ISIN");
      }
      const quantity = decimalParts(position.quantity);
      const price = position.price ? decimalParts(position.price) : undefined;
      const marketValue = position.marketValue ? moneyMinor(position.marketValue) : undefined;
      if (marketValue !== undefined && position.marketValueCurrency) {
        values.push({ amount: marketValue, currency: position.marketValueCurrency });
      }
      holdings.push({
        sourceId: source.id,
        accountId: portfolio.accountId,
        capturedAt: portfolio.capturedAt,
        symbol: position.isin,
        name: position.name,
        quantityAtomic: quantity.atomic,
        atomicDecimals: quantity.decimals,
        priceAtomic: price?.atomic,
        priceDecimals: price?.decimals,
        priceCurrency: position.priceCurrency,
        marketValueMinor: marketValue,
        marketValueCurrency: position.marketValueCurrency,
        owner: account.owner,
        rawHash
      });
    }
    const currencies = new Set(values.map((value) => value.currency));
    if (values.length === portfolio.positions.length && currencies.size === 1) {
      balances.push({
        sourceId: source.id,
        accountId: portfolio.accountId,
        capturedAt: portfolio.capturedAt,
        amountMinor: values.reduce((sum, value) => sum + value.amount, 0n),
        currency: values[0].currency,
        owner: account.owner,
        rawHash
      });
    }
  }
  return {
    raw: {
      provider: "DKB FinTS",
      fetchedAt: new Date().toISOString(),
      portfolios
    },
    holdings,
    balances
  };
}

function scrubMessage(message: string, secrets: Array<string | undefined>): string {
  let scrubbed = message;
  for (const secret of secrets) {
    if (secret) scrubbed = scrubbed.replaceAll(secret, "[geschützt]");
  }
  return scrubbed.slice(0, 2_000);
}

export const runDkbFintsHelper: DkbFintsRunner = (input) => new Promise((resolve, reject) => {
  const helperPath = join(process.cwd(), "python", "dkb_fints_helper.py");
  const child = spawn("python3", [helperPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" }
  });
  const chunks: Buffer[] = [];
  const errors: Buffer[] = [];
  let size = 0;
  const timer = setTimeout(() => child.kill("SIGKILL"), 120_000);
  child.stdout.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size <= 4_194_304) chunks.push(chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    if (errors.reduce((sum, item) => sum + item.length, 0) < 65_536) errors.push(chunk);
  });
  child.on("error", (error) => {
    clearTimeout(timer);
    reject(error);
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    const secrets = [input.productId, input.userId, input.pin, input.tan];
    if (size > 4_194_304) return reject(new Error("DKB-FinTS Hilfsprozess lieferte zu viele Daten"));
    if (code !== 0) {
      const detail = scrubMessage(Buffer.concat(errors).toString("utf8").trim(), secrets);
      return reject(new Error(detail || `DKB-FinTS Hilfsprozess endete mit Code ${code}`));
    }
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as DkbHelperOutput;
      if (parsed.state === "ERROR") throw new Error(scrubMessage(parsed.message, secrets));
      resolve(parsed);
    } catch (error) {
      reject(error);
    }
  });
  child.stdin.end(JSON.stringify(input));
});

function productIdOrThrow(): string {
  const productId = readSecret("dkb-fints-product-id");
  if (!validProductId(productId)) {
    throw new Error("Secret dkb-fints-product-id fehlt oder ist nicht exakt 25 Zeichen lang");
  }
  return productId;
}

export async function preflightDkbFints(
  source: SourceConfig,
  runner: DkbFintsRunner = runDkbFintsHelper
): Promise<SyncResult> {
  try {
    const productId = productIdOrThrow();
    const userId = readSecret("dkb-fints-user-id");
    const pin = readSecret("dkb-fints-pin");
    const result = await runner({
      action: "preflight",
      productId,
      config: helperConfig(source)
    });
    if (!userId || !pin) {
      return {
        state: "WAITING_FOR_USER",
        message: `FinTS-Connector ${result.libraryVersion ?? ""} ist bereit; DKB-Anmeldename und PIN fehlen noch`.replace("  ", " ")
      };
    }
    return {
      state: "READY",
      message: `FinTS-Connector ${result.libraryVersion ?? ""} und lokale Konfiguration sind bereit`.replace("  ", " ")
    };
  } catch (error) {
    return { state: "WAITING_FOR_USER", message: error instanceof Error ? error.message : String(error) };
  }
}

export async function fetchDkbFints(
  source: SourceConfig,
  clientData: string | undefined,
  runner: DkbFintsRunner = runDkbFintsHelper
): Promise<DkbFintsOutcome> {
  const productId = productIdOrThrow();
  const userId = readSecret("dkb-fints-user-id");
  const pin = readSecret("dkb-fints-pin");
  if (!userId || !pin) throw new Error("DKB-FinTS Anmeldename oder PIN fehlt");
  const output = await runner({
    action: "fetch",
    productId,
    userId,
    pin,
    clientData,
    config: helperConfig(source)
  });
  return outcomeFromHelper(source, output);
}

export async function continueDkbFints(
  source: SourceConfig,
  continuation: Record<string, unknown>,
  tan: string | undefined,
  runner: DkbFintsRunner = runDkbFintsHelper
): Promise<DkbFintsOutcome> {
  const productId = productIdOrThrow();
  const userId = readSecret("dkb-fints-user-id");
  const pin = readSecret("dkb-fints-pin");
  if (!userId || !pin) throw new Error("DKB-FinTS Anmeldename oder PIN fehlt");
  const output = await runner({
    action: "continue",
    productId,
    userId,
    pin,
    tan,
    continuation,
    config: helperConfig(source)
  });
  return outcomeFromHelper(source, output);
}

function outcomeFromHelper(source: SourceConfig, output: DkbHelperOutput): DkbFintsOutcome {
  if (output.state === "WAITING_FOR_USER") {
    if (!output.continuation) throw new Error("DKB-FinTS lieferte keinen Fortsetzungszustand");
    return {
      state: "WAITING_FOR_USER",
      message: output.message,
      challenge: output.challenge,
      decoupled: Boolean(output.decoupled),
      continuation: output.continuation
    };
  }
  if (output.state !== "SUCCESS") throw new Error(output.message || "DKB-FinTS Abruf fehlgeschlagen");
  return {
    state: "SUCCESS",
    message: output.message,
    bundle: normalizeDkbFintsBundle(source, output),
    clientData: output.clientData
  };
}
