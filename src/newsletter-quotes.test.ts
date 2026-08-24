import assert from "node:assert/strict";
import test from "node:test";
import { readGhostfolioNewsletterQuotes } from "./newsletter-quotes.js";
import type { AppConfig, NewsletterAnalysis } from "./types.js";

const config = { serverUrl: "http://ghostfolio", accountMap: {} } as NonNullable<AppConfig["ghostfolio"]>;
const analysis = {
  theses: [
    { instrument: "Nvidia", ticker: "NVDA", assetClass: "Aktie" },
    { instrument: "Bitcoin", ticker: "BTC", assetClass: "Kryptowährung" }
  ]
} as NewsletterAnalysis;

test("Newsletterkurse lösen Aktien und Krypto eindeutig über Ghostfolio auf", async () => {
  const fetcher = async (input: string | URL) => {
    const url = String(input);
    if (url.endsWith("/auth/anonymous")) return Response.json({ authToken: "token" });
    if (url.includes("query=Bitcoin")) return Response.json({ items: [
      { symbol: "bitcoin", name: "Bitcoin", dataSource: "COINGECKO", assetSubClass: "CRYPTOCURRENCY", currency: "USD" },
      { symbol: "BTCUSD", name: "Bitcoin", dataSource: "YAHOO", assetSubClass: "CRYPTOCURRENCY", currency: "USD", dataProviderInfo: { name: "Yahoo Finance" } }
    ] });
    if (url.includes("/symbol/lookup")) return Response.json({ items: [
      { symbol: "NVDL", name: "GraniteShares 2x Long NVDA Daily ETF", dataSource: "YAHOO", assetSubClass: "ETF" },
      { symbol: "NVDA", name: "NVIDIA Corporation", dataSource: "YAHOO", assetSubClass: "STOCK", currency: "USD", dataProviderInfo: { name: "Yahoo Finance" } }
    ] });
    if (url.includes("/symbol/YAHOO/NVDA")) return Response.json({ symbol: "NVDA", dataSource: "YAHOO", currency: "USD", marketPrice: 208.48 });
    if (url.includes("/symbol/YAHOO/BTCUSD")) return Response.json({ symbol: "BTCUSD", dataSource: "YAHOO", currency: "USD", marketPrice: 78_785 });
    return new Response(null, { status: 404 });
  };
  const quotes = await readGhostfolioNewsletterQuotes(config, [analysis], { fetcher: fetcher as typeof fetch, securityToken: "secret" });
  assert.deepEqual(quotes.map(({ symbol, priceMinor, source }) => ({ symbol, priceMinor, source })), [
    { symbol: "NVDA", priceMinor: 20_848, source: "Yahoo Finance" },
    { symbol: "BTC", priceMinor: 7_878_500, source: "Yahoo Finance" }
  ]);
});
