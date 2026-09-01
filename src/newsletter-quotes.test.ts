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

test("Tickerlose Basiswerte verwenden das validierte Yahoo-Mapping ohne Lookup", async () => {
  const mappedAnalysis = {
    theses: [
      { instrument: "Chipotle Mexican Grill", ticker: null, assetClass: "Aktie" },
      { instrument: "Northern Star Resources", ticker: null, assetClass: "Aktie" },
      { instrument: "Ivanhoe Mines", ticker: "IVN", assetClass: "Aktie" },
      { instrument: "21Shares Bitcoin Core ETP", ticker: "CBTC", assetClass: "ETP" }
    ]
  } as NewsletterAnalysis;
  const requestedSymbols: string[] = [];
  const fetcher = async (input: string | URL) => {
    const url = String(input);
    if (url.endsWith("/auth/anonymous")) return Response.json({ authToken: "token" });
    assert.doesNotMatch(url, /symbol\/lookup/);
    const match = /\/symbol\/YAHOO\/([^?]+)/.exec(url);
    if (!match) return new Response(null, { status: 404 });
    const symbol = decodeURIComponent(match[1]);
    requestedSymbols.push(symbol);
    if (symbol === "CMG") return Response.json({ symbol, dataSource: "YAHOO", currency: "USD", marketPrice: 38.03 });
    if (symbol === "NST.AX") return Response.json({ symbol, dataSource: "YAHOO", currency: "AUD", marketPrice: 23.69 });
    if (symbol === "IVN.TO") return Response.json({ symbol, dataSource: "YAHOO", currency: "CAD", marketPrice: 12.11 });
    if (symbol === "CBTC.SW") return Response.json({ symbol, dataSource: "YAHOO", currency: "CHF", marketPrice: 15.01 });
    return new Response(null, { status: 404 });
  };
  const quotes = await readGhostfolioNewsletterQuotes(config, [mappedAnalysis], { fetcher: fetcher as typeof fetch, securityToken: "secret" });
  assert.deepEqual(requestedSymbols.sort(), ["CBTC.SW", "CMG", "IVN.TO", "NST.AX"]);
  assert.deepEqual(quotes.map(({ symbol, priceMinor, currency }) => ({ symbol, priceMinor, currency })), [
    { symbol: "CMG", priceMinor: 3_803, currency: "USD" },
    { symbol: "NST.AX", priceMinor: 2_369, currency: "AUD" },
    { symbol: "IVN.TO", priceMinor: 1_211, currency: "CAD" },
    { symbol: "CBTC", priceMinor: 1_501, currency: "CHF" }
  ]);
});

test("Nullkurse aus Ghostfolio lösen bei direkten Yahoo-Symbolen den Yahoo-Fallback aus", async () => {
  const mappedAnalysis = {
    theses: [{ instrument: "21Shares Bitcoin Core ETP", ticker: "CBTC", assetClass: "ETP" }]
  } as NewsletterAnalysis;
  const fetcher = async (input: string | URL) => {
    const url = String(input);
    if (url.endsWith("/auth/anonymous")) return Response.json({ authToken: "token" });
    if (url.includes("/symbol/YAHOO/CBTC.SW")) return Response.json({ symbol: "CBTC.SW", dataSource: "YAHOO", currency: "CHF", marketPrice: 0 });
    if (url.includes("query1.finance.yahoo.com") && url.includes("CBTC.SW")) return Response.json({ chart: { result: [{ meta: { symbol: "CBTC.SW", currency: "CHF", regularMarketPrice: 15.01 } }] } });
    return new Response(null, { status: 404 });
  };
  const quotes = await readGhostfolioNewsletterQuotes(config, [mappedAnalysis], { fetcher: fetcher as typeof fetch, securityToken: "secret" });
  assert.deepEqual(quotes.map(({ symbol, priceMinor, currency }) => ({ symbol, priceMinor, currency })), [
    { symbol: "CBTC", priceMinor: 1_501, currency: "CHF" }
  ]);
});
