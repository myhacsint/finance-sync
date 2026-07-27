import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fetchDkbCsv } from "./dkb-csv.js";

test("DKB-CSV wird begrenzt, normalisiert und ohne falsche Dubletten gelesen", () => {
  const inbox = mkdtempSync(join(tmpdir(), "finance-sync-dkb-csv-"));
  const header = [
    "Buchungsdatum",
    "Wertstellung",
    "Status",
    "Zahlungspflichtige*r",
    "Zahlungsempfänger*in",
    "Verwendungszweck",
    "Umsatztyp",
    "IBAN",
    "Betrag (€)"
  ].join(";");
  const duplicate = [
    "27.04.26",
    "28.04.26",
    "Gebucht",
    "",
    "Händler",
    "\"Text; mit Semikolon\"",
    "Lastschrift",
    "DE001234",
    "-12,34"
  ].join(";");
  const later = [
    "28.04.26",
    "28.04.26",
    "Gebucht",
    "Arbeitgeber",
    "",
    "Gehalt",
    "Überweisung",
    "DE005678",
    "1.234,56"
  ].join(";");
  writeFileSync(
    join(inbox, "history.csv"),
    `${header}\n${duplicate}\n${duplicate}\n${later}\n`,
    "utf8"
  );

  const bundle = fetchDkbCsv({
    id: "dkb-csv",
    kind: "dkb-csv",
    enabled: true,
    owners: ["Erik"],
    settings: {
      file: "history.csv",
      accountId: "stable-account",
      dateBefore: "2026-04-28"
    }
  }, inbox);

  assert.equal(bundle.rawMediaType, "text/csv");
  assert.equal(bundle.transactions?.length, 2);
  assert.deepEqual(
    bundle.transactions?.map(({ amountMinor }) => amountMinor),
    [-1234n, -1234n]
  );
  assert.equal(
    new Set(bundle.transactions?.map(({ sourceTransactionId }) => sourceTransactionId)).size,
    2
  );
  assert.equal(bundle.transactions?.[0].memo, "Text; mit Semikolon · Lastschrift");
});
