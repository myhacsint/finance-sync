import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeDkbFintsBundle,
  validProductId,
  type DkbHelperOutput
} from "./dkb-fints.js";
import type { SourceConfig } from "../types.js";

const source: SourceConfig = {
  id: "dkb-depots",
  kind: "dkb-fints",
  enabled: false,
  settings: {
    accounts: [
      {
        accountId: "dkb-depot-person-a",
        accountNumber: "123456789",
        owner: "Person A"
      }
    ]
  }
};

test("FinTS Produkt-ID muss exakt 25 alphanumerische Zeichen enthalten", () => {
  assert.equal(validProductId("A".repeat(25)), true);
  assert.equal(validProductId("A".repeat(24)), false);
  assert.equal(validProductId(`${"A".repeat(24)}-`), false);
  assert.equal(validProductId(undefined), false);
});

test("DKB-FinTS Bestand wird verlustfrei normalisiert", () => {
  const output: DkbHelperOutput = {
    state: "SUCCESS",
    message: "ok",
    portfolios: [{
      accountId: "dkb-depot-person-a",
      capturedAt: "2026-08-03T10:00:00Z",
      rawMt535: [":16R:FIN\n:35B:ISIN DE0007164600\n:16S:FIN"],
      positions: [{
        isin: "DE0007164600",
        name: "SAP SE",
        quantity: "12.34567",
        price: "191.1250",
        priceCurrency: "EUR",
        marketValue: "2359.94",
        marketValueCurrency: "EUR",
        valuationDate: "2026-08-03"
      }]
    }]
  };
  const bundle = normalizeDkbFintsBundle(source, output);
  assert.equal(bundle.holdings?.length, 1);
  assert.deepEqual(bundle.holdings?.[0], {
    sourceId: "dkb-depots",
    accountId: "dkb-depot-person-a",
    capturedAt: "2026-08-03T10:00:00Z",
    symbol: "DE0007164600",
    name: "SAP SE",
    quantityAtomic: "1234567",
    atomicDecimals: 5,
    priceAtomic: "1911250",
    priceDecimals: 4,
    priceCurrency: "EUR",
    marketValueMinor: 235994n,
    marketValueCurrency: "EUR",
    owner: "Person A",
    rawHash: bundle.holdings?.[0].rawHash
  });
  assert.equal(bundle.balances?.[0].amountMinor, 235994n);
  assert.equal(bundle.balances?.[0].currency, "EUR");
});

test("unvollständige Kurswerte erzeugen keinen erfundenen Depotsaldo", () => {
  const output: DkbHelperOutput = {
    state: "SUCCESS",
    message: "ok",
    portfolios: [{
      accountId: "dkb-depot-person-a",
      capturedAt: "2026-08-03T10:00:00Z",
      rawMt535: ["raw"],
      positions: [{
        isin: "DE0007164600",
        quantity: "1"
      }]
    }]
  };
  const bundle = normalizeDkbFintsBundle(source, output);
  assert.equal(bundle.holdings?.length, 1);
  assert.equal(bundle.balances?.length, 0);
});
