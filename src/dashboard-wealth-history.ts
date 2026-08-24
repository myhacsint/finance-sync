import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSecret } from "./config.js";
import type { AppConfig } from "./types.js";

interface ActualHistoryApi {
  init(options: { dataDir: string; serverURL: string; password: string }): Promise<unknown>;
  downloadBudget(id: string): Promise<void>;
  getAccounts(): Promise<Array<{ id: string; closed?: boolean; offbudget?: boolean }>>;
  getTransactions(accountId: string, startDate: string, endDate: string): Promise<Array<{
    date?: string; starting_balance_flag?: boolean;
  }>>;
  getAccountBalance(accountId: string, cutoff?: Date): Promise<number>;
  shutdown(): Promise<void>;
}

export interface WealthHistoryPoint {
  date: string;
  totalMinor: number;
  cashMinor: number;
  investmentsMinor: number;
  quality: "measured" | "reconstructed" | "partial";
}

export interface DashboardWealthHistory {
  generatedAt: string;
  points: WealthHistoryPoint[];
  coverage: {
    start: string;
    completeFrom: string;
    note: string;
  };
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function historyDates(now: Date, start = "2023-12-31"): string[] {
  const result = new Set<string>();
  const startDate = new Date(`${start}T12:00:00Z`);
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0, 12));
  while (cursor <= now) {
    result.add(isoDate(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 2, 0);
  }
  const dailyStart = new Date(now);
  dailyStart.setUTCDate(dailyStart.getUTCDate() - 35);
  for (const day = dailyStart; day <= now; day.setUTCDate(day.getUTCDate() + 1)) {
    result.add(isoDate(day));
  }
  result.add(isoDate(now));
  return [...result].sort();
}

async function ghostfolioPerformance(
  config: NonNullable<AppConfig["ghostfolio"]>,
  options: { fetcher?: typeof fetch; accessToken?: string } = {}
): Promise<Array<{
  date: string; valueMinor: number;
}>> {
  const accessToken = options.accessToken ?? readSecret("ghostfolio-security-token");
  if (!accessToken) throw new Error("Ghostfolio-Zugang ist nicht verfügbar");
  const fetcher = options.fetcher ?? fetch;
  const authResponse = await fetcher(new URL("/api/v1/auth/anonymous", config.serverUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken }),
    signal: AbortSignal.timeout(30_000)
  });
  if (!authResponse.ok) throw new Error(`Ghostfolio Anmeldung HTTP ${authResponse.status}`);
  const auth = await authResponse.json() as { authToken?: string };
  if (!auth.authToken) throw new Error("Ghostfolio lieferte keinen Bearer-Token");
  const response = await fetcher(new URL("/api/v2/portfolio/performance?range=max", config.serverUrl), {
    headers: { authorization: `Bearer ${auth.authToken}` },
    signal: AbortSignal.timeout(90_000)
  });
  if (!response.ok) throw new Error(`Ghostfolio Historie HTTP ${response.status}`);
  const payload = await response.json() as { chart?: Array<{ date?: string; value?: number; netWorth?: number }> };
  return (payload.chart ?? []).flatMap((point) => {
    const value = Number.isFinite(point.netWorth) ? Number(point.netWorth) : Number(point.value);
    return point.date && Number.isFinite(value)
      ? [{ date: point.date.slice(0, 10), valueMinor: Math.round(value * 100) }]
      : [];
  }).sort((left, right) => left.date.localeCompare(right.date));
}

function latestAtOrBefore<T extends { date: string }>(rows: T[], date: string): T | undefined {
  let found: T | undefined;
  for (const row of rows) {
    if (row.date > date) break;
    found = row;
  }
  return found;
}

export async function readDashboardWealthHistory(
  config: AppConfig,
  now = new Date(),
  options: {
    loadActual?: () => Promise<ActualHistoryApi>;
    password?: string;
    fetcher?: typeof fetch;
    ghostfolioAccessToken?: string;
  } = {}
): Promise<DashboardWealthHistory> {
  if (!config.actual?.enabled) throw new Error("Actual ist deaktiviert");
  if (!config.ghostfolio?.enabled) throw new Error("Ghostfolio ist deaktiviert");
  const password = options.password ?? readSecret("actual-password");
  if (!password) throw new Error("Actual-Zugang ist nicht verfügbar");
  const dates = historyDates(now);
  const investments = await ghostfolioPerformance(config.ghostfolio, {
    fetcher: options.fetcher,
    accessToken: options.ghostfolioAccessToken
  });
  const dataDir = mkdtempSync(join(tmpdir(), "finance-wealth-history-"));
  const actual = await (options.loadActual ?? (async () =>
    await import("@actual-app/api") as unknown as ActualHistoryApi))();
  let initialized = false;
  try {
    await actual.init({ dataDir, serverURL: config.actual.serverUrl, password });
    initialized = true;
    await actual.downloadBudget(config.actual.budgetId);
    const accounts = (await actual.getAccounts()).filter((account) => !account.closed);
    const anchors = (await Promise.all(accounts.map(async (account) => {
      const transactions = await actual.getTransactions(account.id, "2000-01-01", isoDate(now));
      return transactions
        .filter((transaction) => transaction.starting_balance_flag && transaction.date)
        .map((transaction) => transaction.date!)
        .sort()[0];
    }))).filter((date): date is string => Boolean(date));
    const cashCompleteFrom = anchors.sort().at(-1) ?? "2024-07-31";
    const points = await Promise.all(dates.map(async (date): Promise<WealthHistoryPoint | null> => {
      const investment = latestAtOrBefore(investments, date);
      if (!investment) return null;
      const cutoff = new Date(`${date}T23:59:59.999Z`);
      const cashMinor = (await Promise.all(accounts.map((account) =>
        actual.getAccountBalance(account.id, cutoff)
      ))).reduce((sum, value) => sum + Math.round(value), 0);
      const complete = date >= cashCompleteFrom && date >= "2026-07-27";
      return {
        date,
        cashMinor,
        investmentsMinor: investment.valueMinor,
        totalMinor: cashMinor + investment.valueMinor,
        quality: date === isoDate(now) ? "measured" : complete ? "reconstructed" : "partial"
      };
    }));
    const filtered = points.filter((point): point is WealthHistoryPoint => Boolean(point));
    return {
      generatedAt: now.toISOString(),
      points: filtered,
      coverage: {
        start: filtered[0]?.date ?? isoDate(now),
        completeFrom: [cashCompleteFrom, "2026-07-27"].sort().at(-1)!,
        note: "Vor dem vollständigen Quellenstand zeigt die Linie das nachweisbare Mindestvermögen und ist als unvollständig markiert."
      }
    };
  } finally {
    if (initialized) await actual.shutdown().catch(() => undefined);
    rmSync(dataDir, { recursive: true, force: true });
  }
}
