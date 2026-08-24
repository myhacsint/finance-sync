import { readSecret } from "./config.js";
import type { AppConfig, NewsletterAnalysis } from "./types.js";

type LookupItem = {
  symbol?: string;
  name?: string;
  currency?: string;
  dataSource?: string;
  assetSubClass?: string;
  dataProviderInfo?: { name?: string };
};

export type NewsletterQuote = {
  symbol: string;
  name: string;
  priceMinor: number;
  currency: string;
  capturedAt: string;
  source: string;
};

const SPECIAL_SYMBOLS: Record<string, { dataSource: string; symbol: string }> = {
  "EUR/USD": { dataSource: "YAHOO", symbol: "EURUSD=X" },
  DXY: { dataSource: "YAHOO", symbol: "DX-Y.NYB" },
  HBAR: { dataSource: "YAHOO", symbol: "HBARUSD" },
  FET: { dataSource: "YAHOO", symbol: "FETUSD" },
  MANA: { dataSource: "YAHOO", symbol: "MANAUSD" },
  POL: { dataSource: "YAHOO", symbol: "POLUSD" },
  "COINBASE GLOBAL INC.": { dataSource: "YAHOO", symbol: "COIN" },
  "XAU/USD": { dataSource: "YAHOO", symbol: "GC=F" },
  "XAG/USD": { dataSource: "YAHOO", symbol: "SI=F" },
  GOLD: { dataSource: "YAHOO", symbol: "GC=F" },
  SILVER: { dataSource: "YAHOO", symbol: "SI=F" },
  SPX: { dataSource: "YAHOO", symbol: "^GSPC" },
  "S&P 500": { dataSource: "YAHOO", symbol: "^GSPC" },
  NDX: { dataSource: "YAHOO", symbol: "^NDX" },
  DJI: { dataSource: "YAHOO", symbol: "^DJI" },
  WTI: { dataSource: "YAHOO", symbol: "CL=F" },
  "ÖL": { dataSource: "YAHOO", symbol: "CL=F" }
};

function normalized(value: string | undefined): string {
  return String(value ?? "").normalize("NFKD").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function isCrypto(assetClass: string | undefined): boolean {
  return /crypto|krypto/i.test(String(assetClass ?? ""));
}

function chooseLookup(items: LookupItem[], instrument: string, ticker: string, assetClass?: string): LookupItem | undefined {
  const crypto = isCrypto(assetClass);
  const candidates = items.filter((item) => crypto
    ? item.dataSource === "COINGECKO" || item.assetSubClass === "CRYPTOCURRENCY"
    : item.dataSource === "YAHOO" && item.assetSubClass !== "CRYPTOCURRENCY")
    .sort((a, b) => Number(b.dataSource === "YAHOO") - Number(a.dataSource === "YAHOO"));
  const tickerKey = normalized(ticker);
  const instrumentKey = normalized(instrument);
  return candidates.find((item) => normalized(item.symbol) === tickerKey)
    ?? candidates.find((item) => normalized(item.name) === instrumentKey);
}

async function poolMap<T, R>(values: T[], concurrency: number, task: (value: T) => Promise<R>): Promise<R[]> {
  const output: R[] = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await task(values[index]);
    }
  }));
  return output;
}

export async function readGhostfolioNewsletterQuotes(
  config: NonNullable<AppConfig["ghostfolio"]>,
  analyses: NewsletterAnalysis[],
  options: { fetcher?: typeof fetch; securityToken?: string } = {}
): Promise<NewsletterQuote[]> {
  const fetcher = options.fetcher ?? fetch;
  const securityToken = options.securityToken ?? readSecret("ghostfolio-security-token");
  if (!securityToken) return [];
  const authResponse = await fetcher(new URL("/api/v1/auth/anonymous", config.serverUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken: securityToken }),
    signal: AbortSignal.timeout(30_000)
  });
  if (!authResponse.ok) return [];
  const auth = await authResponse.json() as { authToken?: string };
  if (!auth.authToken) return [];
  const headers = { authorization: `Bearer ${auth.authToken}` };
  const unique = new Map<string, { instrument: string; ticker: string; assetClass?: string }>();
  for (const analysis of analyses) for (const thesis of analysis.theses) {
    const ticker = String(thesis.ticker ?? "").trim();
    if (!ticker) continue;
    unique.set(`${normalized(ticker)}:${normalized(thesis.instrument)}`, {
      instrument: thesis.instrument,
      ticker,
      assetClass: thesis.assetClass
    });
  }
  const capturedAt = new Date().toISOString();
  const results = await poolMap([...unique.values()], 6, async (request): Promise<NewsletterQuote | undefined> => {
    try {
      const ticker = request.ticker.toUpperCase();
      const special = SPECIAL_SYMBOLS[ticker];
      let selected: LookupItem | undefined = special ? { ...special, name: request.instrument } : undefined;
      if (!selected) {
        const queries = isCrypto(request.assetClass) || request.ticker.length > 12
          ? [request.instrument]
          : [request.ticker, request.instrument];
        for (const query of [...new Set(queries)]) {
          const lookupUrl = new URL("/api/v1/symbol/lookup", config.serverUrl);
          lookupUrl.searchParams.set("query", query);
          lookupUrl.searchParams.set("includeIndices", "true");
          const lookupResponse = await fetcher(lookupUrl, { headers, signal: AbortSignal.timeout(20_000) });
          if (!lookupResponse.ok) continue;
          const lookup = await lookupResponse.json() as { items?: LookupItem[] };
          selected = chooseLookup(lookup.items ?? [], request.instrument, request.ticker, request.assetClass);
          if (selected) break;
        }
      }
      if (!selected?.dataSource || !selected.symbol) return undefined;
      const quoteUrl = new URL(`/api/v1/symbol/${encodeURIComponent(selected.dataSource)}/${encodeURIComponent(selected.symbol)}`, config.serverUrl);
      const quoteResponse = await fetcher(quoteUrl, { headers, signal: AbortSignal.timeout(20_000) });
      let quote = quoteResponse.ok
        ? await quoteResponse.json() as { marketPrice?: number; currency?: string; symbol?: string; dataSource?: string }
        : undefined;
      if ((!quote || !Number.isFinite(quote.marketPrice)) && selected.dataSource === "YAHOO") {
        const yahooUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(selected.symbol)}`);
        yahooUrl.searchParams.set("range", "1d");
        yahooUrl.searchParams.set("interval", "1d");
        const yahooResponse = await fetcher(yahooUrl, { signal: AbortSignal.timeout(20_000) });
        if (yahooResponse.ok) {
          const yahoo = await yahooResponse.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; currency?: string; symbol?: string } }> } };
          const meta = yahoo.chart?.result?.[0]?.meta;
          quote = { marketPrice: meta?.regularMarketPrice, currency: meta?.currency, symbol: meta?.symbol, dataSource: "YAHOO" };
        }
      }
      if (!quote) return undefined;
      if (!Number.isFinite(quote.marketPrice) || !quote.currency) return undefined;
      return {
        symbol: request.ticker,
        name: request.instrument,
        priceMinor: Math.round(Number(quote.marketPrice) * 100),
        currency: quote.currency,
        capturedAt,
        source: selected.dataProviderInfo?.name ?? (quote.dataSource === "COINGECKO" ? "CoinGecko via Ghostfolio" : "Yahoo Finance via Ghostfolio")
      };
    } catch {
      return undefined;
    }
  });
  return results.filter((item): item is NewsletterQuote => Boolean(item));
}
