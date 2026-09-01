import assert from "node:assert/strict";
import test from "node:test";
import { buildCouncilInvestmentSnapshot } from "./council-investment.js";
import type { NewsletterAnalysis } from "./types.js";

test("Council-Snapshot enthält Cockpitdaten, aber keine Postfach- oder Absenderdaten", () => {
  const item = {
    messageId: "private-message-id",
    inboxId: "private-inbox@example.test",
    sender: "private-sender@example.test",
    contentHash: "private-hash",
    model: "internal-model",
    source: "HKCM",
    subject: "Marktupdate",
    receivedAt: "2026-08-25T10:00:00.000Z",
    analyzedAt: "2026-08-25T10:01:00.000Z",
    state: "UNREVIEWED",
    summary: "Bitcoin bleibt konstruktiv.",
    uncertainties: [],
    theses: [{ instrument: "Bitcoin", ticker: "BTC", assetClass: "Kryptowährung", stance: "BULLISH", horizon: "langfristig", entryZone: null, targetZone: "$100,000", invalidation: "$70,000", catalysts: [], risks: [], evidence: ["belegte Aussage"] }]
  } as NewsletterAnalysis;
  const snapshot = buildCouncilInvestmentSnapshot({
    generatedAt: "2026-08-25T10:02:00.000Z",
    state: "ready",
    items: [item],
    prices: [{ symbol: "BTC", name: "Bitcoin", priceMinor: 8_000_000, currency: "USD", source: "Yahoo Finance" }]
  });
  assert.equal(snapshot.counts.theses, 1);
  assert.equal(snapshot.instrumentGroups[0]?.synthesis, "Bitcoin bleibt konstruktiv.");
  assert.equal(snapshot.instrumentGroups[0]?.evidence[0]?.text, "belegte Aussage");
  assert.equal(snapshot.instrumentGroups[0]?.currentPrice?.priceMinor, 8_000_000);
  assert.equal(snapshot.analyses[0]?.theses[0]?.targetZone, "$100,000");
  assert.equal(snapshot.prices[0]?.instrumentKey, "BTC");
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /private-message-id|private-inbox|private-sender|private-hash|internal-model/);
});

test("Tickerlose und getickerte Coinbase-Thesen werden in COIN zusammengeführt", () => {
  const common = {
    messageId: "message",
    inboxId: "inbox",
    sender: "sender",
    contentHash: "hash",
    model: "model",
    analyzedAt: "2026-09-01T10:01:00.000Z",
    state: "UNREVIEWED" as const,
    uncertainties: [] as string[]
  };
  const items = [
    {
      ...common,
      subject: "Friedrich",
      receivedAt: "2026-09-01T10:00:00.000Z",
      summary: "Tickerlose Coinbase-These",
      theses: [{ instrument: "Coinbase Global Inc.", ticker: null, assetClass: "Aktie", stance: "BULLISH", horizon: null, entryZone: "$146", targetZone: null, invalidation: null, catalysts: [], risks: [], evidence: [] }]
    },
    {
      ...common,
      messageId: "message-2",
      subject: "HKCM",
      receivedAt: "2026-08-31T10:00:00.000Z",
      summary: "Getickerte Coinbase-These",
      theses: [{ instrument: "Coinbase", ticker: "COIN", assetClass: "Aktie", stance: "MIXED", horizon: null, entryZone: null, targetZone: null, invalidation: null, catalysts: [], risks: [], evidence: [] }]
    }
  ] as NewsletterAnalysis[];
  const snapshot = buildCouncilInvestmentSnapshot({
    generatedAt: "2026-09-01T10:02:00.000Z",
    state: "ready",
    items,
    prices: [{ symbol: "COIN", name: "Coinbase Global", priceMinor: 18_812, currency: "USD" }]
  });
  assert.equal(snapshot.instrumentGroups.length, 1);
  assert.equal(snapshot.instrumentGroups[0]?.instrumentKey, "COIN");
  assert.equal(snapshot.instrumentGroups[0]?.ticker, "COIN");
  assert.equal(snapshot.instrumentGroups[0]?.supportedBy, 2);
  assert.equal(snapshot.instrumentGroups[0]?.currentPrice?.priceMinor, 18_812);
});

test("Namensgleiche tickerlose Gruppen übernehmen einen vorhandenen Ticker", () => {
  const items = [{
    messageId: "message",
    inboxId: "inbox",
    sender: "sender",
    contentHash: "hash",
    model: "model",
    subject: "Zwei Thesen",
    receivedAt: "2026-09-01T10:00:00.000Z",
    analyzedAt: "2026-09-01T10:01:00.000Z",
    state: "UNREVIEWED",
    summary: "BrasilAgro",
    uncertainties: [],
    theses: [
      { instrument: "BrasilAgro ADR", ticker: null, assetClass: "Aktie", stance: "BULLISH", horizon: null, entryZone: null, targetZone: null, invalidation: null, catalysts: [], risks: [], evidence: [] },
      { instrument: "BrasilAgro ADR", ticker: "LND", assetClass: "Aktie", stance: "BULLISH", horizon: null, entryZone: null, targetZone: null, invalidation: null, catalysts: [], risks: [], evidence: [] }
    ]
  }] as NewsletterAnalysis[];
  const snapshot = buildCouncilInvestmentSnapshot({ generatedAt: "2026-09-01T10:02:00.000Z", state: "ready", items, prices: [] });
  assert.equal(snapshot.instrumentGroups.length, 1);
  assert.equal(snapshot.instrumentGroups[0]?.instrumentKey, "LND");
  assert.equal(snapshot.instrumentGroups[0]?.ticker, "LND");
});
