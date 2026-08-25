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
