import assert from "node:assert/strict";
import test from "node:test";
import { FinanceDatabase } from "./database.js";
import {
  buildNewsletterAnalysis,
  newsletterContentHash,
  validateNewsletterModelResult
} from "./newsletter-analysis.js";

const message = {
  messageId: "mail-1",
  inboxId: "invest@example.test",
  sender: "brief@example.test",
  subject: "Marktausblick",
  receivedAt: "2026-08-24T12:00:00.000Z",
  content: "DAX bleibt oberhalb 18000 konstruktiv. Unterhalb wäre die These ungültig."
};

test("validiert und persistiert eine nachvollziehbare Newsletteranalyse", () => {
  const result = validateNewsletterModelResult({
    summary: "Konstruktiver DAX-Ausblick.",
    uncertainties: ["Kein Zeithorizont genannt"],
    theses: [{
      instrument: "DAX", ticker: null, assetClass: "Aktienindex", stance: "BULLISH",
      horizon: null, entryZone: null, targetZone: null, invalidation: "Unter 18.000",
      catalysts: [], risks: ["Bruch von 18.000"], evidence: ["oberhalb 18000 konstruktiv"]
    }]
  });
  const analysis = buildNewsletterAnalysis(message, "test-model", result, new Date("2026-08-24T13:00:00Z"));
  assert.equal(analysis.state, "UNREVIEWED");
  assert.equal(analysis.theses[0]?.instrument, "DAX");

  const db = new FinanceDatabase(":memory:");
  db.saveNewsletterAnalysis(analysis);
  assert.equal(db.hasNewsletterAnalysis(message.messageId, newsletterContentHash(message)), true);
  assert.deepEqual(db.listNewsletterAnalyses(), [analysis]);
  db.close();
});

test("weist unstrukturierte oder unbelegte Modellantworten zurück", () => {
  assert.throws(() => validateNewsletterModelResult({ summary: "x" }), /Thesenliste/);
  assert.throws(() => validateNewsletterModelResult({ summary: "x", uncertainties: [], theses: [{
    instrument: "", stance: "BUY"
  }] }), /Ausrichtung/);
});
