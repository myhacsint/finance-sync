import test from "node:test";
import assert from "node:assert/strict";
import { parseSutorStatementPages, validIsin } from "./sutor-statement-parser.js";
import type { PensionTextPage } from "./drv-pension-parser.js";

function pages(options: { ocr?: boolean; cash?: string; total?: string; duplicate?: boolean; mismatchDate?: boolean } = {}): PensionTextPage[] {
  const method = options.ocr ? "ocr" : "native";
  const confidence = options.ocr ? 0.78 : 0.98;
  const secondIsin = options.duplicate ? "IE00B8KGV557" : "IE00BL25JN58";
  return [
    { page: 1, method, confidence, text: `Depotauszug\nAufstellung über die Kundenfinanzinstrumente per 27.07.2026` },
    { page: 2, method, confidence, text: "Absichtlicher synthetischer Seitenumbruch ohne private Daten" },
    { page: 3, method, confidence, text: `
Aufstellung über Kundenfinanzinstrumente per ${options.mismatchDate ? "28.07.2026" : "27.07.2026"}
Investment ISIN Lagerstelle Verwahrart Anlagequote Bestand Einheit Kurs Währung Kurswert
Fonds
Synthetic Europe Fund IE00B8KGV557 Irland Wertpapierrechnung 50,00 % 10,0000 Anteile 100,0000 EUR 1.000,00 EUR
Synthetic World Fund ${secondIsin} Irland Wertpapierrechnung 50,00 % 10,0000 Anteile 113,7700 US$* 1.000,00 EUR
* Währungskurs: 1,1377 US$
Kurswert Gesamt ${options.total ?? "2.000,00"} EUR
Geldsaldo ${options.cash ?? "-10,00"} EUR
` },
    { page: 4, method, confidence, text: "Umsätze Transaktion Kauf IE00B8KGV557 99,0000 EUR" },
    { page: 5, method, confidence, text: "Weitere synthetische Umsatzseite" },
    { page: 6, method, confidence, text: "Weitere synthetische Umsatzseite" },
    { page: 7, method, confidence, text: "Weitere synthetische Umsatzseite" }
  ];
}

test("parses a dynamic ISIN-anchored holdings table and ignores transaction pages", () => {
  const parsed = parseSutorStatementPages(pages());
  assert.equal(parsed.statementDate, "2026-07-27");
  assert.equal(parsed.statementDateOccurrences.length, 2);
  assert.equal(parsed.positions.length, 2);
  assert.equal(parsed.totalMarketValueMinor, "200000");
  assert.equal(parsed.cashMinor, "-1000");
  assert.equal(parsed.contractValueMinor, "199000");
  assert.equal(parsed.warnings.length, 0);
  assert.ok(parsed.positions.every((position) => position.provenance.page === 3));
});

test("ISIN validation, date conflict, duplicates and sum errors are deterministic", () => {
  assert.equal(validIsin("IE00B8KGV557"), true);
  assert.equal(validIsin("IE00B8KGV558"), false);
  assert.throws(() => parseSutorStatementPages(pages({ mismatchDate: true })), /SUTOR_STATEMENT_DATES_CONFLICT/);
  assert.throws(() => parseSutorStatementPages(pages({ duplicate: true })), /SUTOR_ISIN_DUPLICATE/);
  assert.throws(() => parseSutorStatementPages(pages({ total: "2.000,01" })), /SUTOR_POSITION_SUM_MISMATCH/);
});

test("OCR-derived mandatory cells remain blocking and legacy no-ISIN format is routed safely", () => {
  const parsed = parseSutorStatementPages(pages({ ocr: true }));
  assert.equal(parsed.extractionMethod, "ocr");
  assert.ok(parsed.positions.every((position) => position.validatorCodes.includes("OCR_REVIEW_REQUIRED")));
  assert.throws(() => parseSutorStatementPages([{ page: 1, method: "native", confidence: 0.98, text: "Depotbestände Investment Anteile Kursdatum Depotwert ohne ISIN" }]), /SUTOR_HOLDINGS_TABLE_MISSING/);
});

test("negative cash is valid but a negative derived contract is rejected", () => {
  assert.equal(parseSutorStatementPages(pages({ cash: "-10,00" })).cashMinor, "-1000");
  assert.throws(() => parseSutorStatementPages(pages({ cash: "-2.100,00" })), /SUTOR_CONTRACT_VALUE_INVALID/);
});
