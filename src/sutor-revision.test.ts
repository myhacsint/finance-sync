import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FinanceDatabase } from "./database.js";
import { parseSutorStatementPages } from "./sutor-statement-parser.js";
import { SutorPreviewStore } from "./sutor-preview-store.js";
import { createConfirmedSutorRevision } from "./sutor-revisions.js";
import type { AppConfig, SourceConfig } from "./types.js";

const source: SourceConfig = {
  id: "synthetic-sutor",
  kind: "manual",
  enabled: true,
  owners: ["Person A"],
  settings: { manualWorkflow: { provider: "sutor", accountId: "synthetic-riester", owner: "Person A" } }
};

const config: AppConfig = {
  port: 8080,
  timezone: "Europe/Berlin",
  sources: [source],
  ghostfolio: {
    enabled: true,
    serverUrl: "http://ghostfolio.invalid",
    accountMap: { "synthetic-riester": "synthetic-account" },
    holdingMap: {
      IE00B8KGV557: { dataSource: "YAHOO", symbol: "SYN1", currency: "EUR" },
      IE00BL25JN58: { dataSource: "YAHOO", symbol: "SYN2", currency: "EUR" }
    }
  }
};

function statement(method: "native" | "ocr" = "native") {
  const confidence = method === "native" ? 0.98 : 0.75;
  return parseSutorStatementPages([
    { page: 1, method, confidence, text: "Aufstellung über die Kundenfinanzinstrumente per 27.07.2026" },
    { page: 3, method, confidence, text: `
Aufstellung über Kundenfinanzinstrumente per 27.07.2026
Investment ISIN Lagerstelle Verwahrart Anlagequote Bestand Einheit Kurs Währung Kurswert
Synthetic A IE00B8KGV557 Irland Wertpapierrechnung 50,00 % 10,0000 Anteile 100,0000 EUR 1.000,00 EUR
Synthetic B IE00BL25JN58 Irland Wertpapierrechnung 50,00 % 10,0000 Anteile 113,7700 US$* 1.000,00 EUR
* Währungskurs: 1,1377 US$
Kurswert Gesamt 2.000,00 EUR
Geldsaldo 0,00 EUR`
    }
  ]);
}

test("preview exposes only derived fields, delta and explicit mapping state", () => {
  const store = new SutorPreviewStore();
  const preview = store.create({
    documentHash: "synthetic-hash-1", pageCount: 7, sizeBytes: 4000,
    statement: statement(), source, config,
    previous: { statementDate: "2026-06-30", contractValueMinor: "190000" },
    snapshotState: "new", duplicate: null
  });
  assert.equal(preview.canConfirm, true);
  assert.equal(preview.deltaMinor, "10000");
  assert.equal(preview.positions.length, 2);
  assert.doesNotMatch(JSON.stringify(preview), /Person A|synthetic-riester|synthetic-account|rawText|fullText|documentHash/);

  const ocr = store.create({
    documentHash: "synthetic-hash-ocr", pageCount: 7, sizeBytes: 4000,
    statement: statement("ocr"), source, config, previous: null, snapshotState: "new", duplicate: null
  });
  assert.equal(ocr.canConfirm, false);
  assert.ok(ocr.warnings.includes("OCR_REVIEW_REQUIRED"));
});

test("confirmation is USER_CONFIRMED, derived-only and duplicate-safe", () => {
  const root = mkdtempSync(join(tmpdir(), "sutor-revision-"));
  const file = join(root, "finance.sqlite");
  const db = new FinanceDatabase(file);
  const store = new SutorPreviewStore();
  const summary = store.create({
    documentHash: "synthetic-hash-confirm", pageCount: 7, sizeBytes: 4000,
    statement: statement(), source, config, previous: null, snapshotState: "new", duplicate: null
  });
  const stored = store.take(summary.id);
  const revision = createConfirmedSutorRevision(stored, "SYNCED", "2026-08-28T12:00:00.000Z");
  assert.equal(db.confirmSutorRevision(stored, revision).created, true);
  assert.equal(db.confirmSutorRevision(stored, revision).created, false);
  assert.equal(db.query("SELECT count(*) AS count FROM sutor_revisions")[0].count, 1);
  assert.equal(db.query("SELECT count(*) AS count FROM sutor_audit_events WHERE event='USER_CONFIRMED'")[0].count, 1);
  assert.equal(db.query("SELECT retention_mode FROM sutor_document_receipts")[0].retention_mode, "derived-only");
  db.close();
  const bytes = readFileSync(file).toString("latin1");
  assert.doesNotMatch(bytes, /Person A|rawText|fullText|IBAN|Depotnummer/);
});
