import test from "node:test";
import assert from "node:assert/strict";
import {
  ManualPreviewStore,
  parseManualWorkflowText
} from "./manual-workflow.js";
import type { AppConfig, SourceConfig } from "./types.js";

const sutorSource: SourceConfig = {
  id: "sutor-riester",
  kind: "manual",
  enabled: true,
  owners: ["Person A"],
  settings: {
    manualWorkflow: {
      provider: "sutor",
      accountId: "riester-1",
      owner: "Person A",
      label: "Sutor Riester"
    }
  }
};

const sutorText = `
Raisin-Pension Riester | Depotbestände
Investment                                     Anteile      Investment-    Kursdatum        Geldsaldo        Depotwert
Amundi Solution MSCI Europe Min Vol           52,2353      167,8600 EUR    17.07.2026            0,00          8.768,22
iShares Edge MSCI EM Min Vol ETF             178,6962      42,9840 US$*)   17.07.2026            0,00          6.717,16
iShares Edge MSCI USA Min Vol ESG            664,6655       8,7207 US$*)   17.07.2026            0,00          5.068,95
iShares Edge MSCI World Minimum V.           221,7449      75,4529 US$*)   17.07.2026            0,00         14.631,65
iShares MSCI Europe Minimum Volat.           235,6483       74,4650 EUR    17.07.2026            0,00         17.547,55
Xtrackers MSCI World Min Vol ETF             446,6232      50,5809 US$*)   17.07.2026            0,00         19.755,67
*) Währungskurs (EUR/US$) 1,1435                                           Summe:                0,00         72.489,20
`;

const sutorColumnText = `
Raisin-Pension Riester | Depotbestände
Investment
Konto
Amundi Solution MSCI Europe Min Vol
iShares Edge MSCI EM Min Vol ETF
iShares Edge MSCI USA Min Vol ESG
iShares Edge MSCI World Minimum V.
iShares MSCI Europe Minimum Volat.
Xtrackers MSCI World Min Vol ETF
*) Währungskurs (EUR/US$) 1,1435
Anteile
Investment-
Kurs
Kursdatum
52,2353
178,6962
664,6655
221,7449
235,6483
446,6232
167,8600 EUR
42,9840 US$*)
8,7207 US$*)
75,4529 US$*)
74,4650 EUR
50,5809 US$*)
17.07.2026
17.07.2026
17.07.2026
17.07.2026
17.07.2026
17.07.2026
Summe:
Geldsaldo
in EUR
0,00
0,00
0,00
0,00
0,00
0,00
0,00
0,00
Depotwert
in EUR
8.768,22
6.717,16
5.068,95
14.631,65
17.547,55
19.755,67
72.489,20
`;

const alteSource: SourceConfig = {
  id: "alte-leipziger",
  kind: "manual",
  enabled: true,
  owners: ["Person A"],
  settings: {
    manualWorkflow: {
      provider: "alte-leipziger",
      accountId: "pension-1",
      owner: "Person A",
      label: "Alte Leipziger"
    }
  }
};

const alteText = `
Rente mit Fondsanlage
Aktuell zu zahlender Beitrag
148,76 €
Todesfall
Stand zum
01.07.2026
Gesamte Todesfallleistung
38.854,41 €
Kündigung
Stand zum
01.07.2026
Gesamter Rückkaufswert
38.854,41 €
Fondsbestand
Gesamtdepot
38.709,47 €
AL GlobalAktiv+ 236,58 €
Anteile: 1.16202 St. / Kurs: 203,59 €
Stand zum: 24.07.2026
Dimensional Global Core Equity Fund 7.796,95 €
Anteile: 130.01421 St. / Kurs: 59,97 €
Stand zum: 24.07.2026
Dimensional Global Core Equity Lower Carbon ESG Screened Fund 7.787,26 €
Anteile: 177.22475 St. / Kurs: 43,94 €
Stand zum: 24.07.2026
iShares Core MSCI World ETF 7.739,65 €
Anteile: 61.76406 St. / Kurs: 125,31 €
Stand zum: 24.07.2026
iShares Global Govt Bond ETF 5.685,49 €
Anteile: 75.07584 St. / Kurs: 75,73 €
Stand zum: 24.07.2026
iShares NASDAQ-100 ETF 5.503,91 €
Anteile: 22.72464 St. / Kurs: 242,20 €
Stand zum: 24.07.2026
Xtrackers MSCI Europe Small Cap ETF 3.959,63 €
Anteile: 53.87984 St. / Kurs: 73,49 €
Stand zum: 24.07.2026
`;

test("Sutor-Depottext wird centgenau und verlustfrei erkannt", () => {
  const { snapshot } = parseManualWorkflowText(sutorSource, sutorText);
  assert.equal(snapshot.amount, "72489.20");
  assert.equal(snapshot.capturedAt, "2026-07-17T23:59:59+02:00");
  assert.equal(snapshot.holdings?.length, 6);
  assert.deepEqual(snapshot.holdings?.[1], {
    symbol: "IE00B8KGV557",
    name: "iShares Edge MSCI EM Min Vol ETF",
    quantityAtomic: "1786962",
    atomicDecimals: 4,
    currency: "USD",
    priceAtomic: "429840",
    priceDecimals: 4,
    priceCurrency: "USD",
    marketValueMinor: "671716",
    marketValueCurrency: "EUR"
  });
});

test("spaltenweise kopierter Sutor-PDF-Text wird erkannt", () => {
  const { snapshot } = parseManualWorkflowText(sutorSource, sutorColumnText);
  assert.equal(snapshot.amount, "72489.20");
  assert.equal(snapshot.capturedAt, "2026-07-17T23:59:59+02:00");
  assert.equal(snapshot.holdings?.length, 6);
  assert.equal(snapshot.holdings?.[5].quantityAtomic, "4466232");
  assert.equal(snapshot.holdings?.[5].marketValueMinor, "1975567");
});

test("Alte-Leipziger-Portaltext trennt Fonds- und Vertragswerte", () => {
  const { snapshot } = parseManualWorkflowText(alteSource, alteText);
  assert.equal(snapshot.amount, "38709.47");
  assert.equal(snapshot.capturedAt, "2026-07-24T23:59:59+02:00");
  assert.equal(snapshot.holdings?.length, 7);
  assert.equal(snapshot.details?.monthlyContributionMinor, "14876");
  assert.equal(snapshot.details?.surrenderValueMinor, "3885441");
  assert.equal(snapshot.details?.deathBenefitMinor, "3885441");
  assert.equal(snapshot.holdings?.[0].quantityAtomic, "116202");
});

test("Vorschau enthält keinen eingefügten Rohtext und prüft Ghostfolio-Zuordnungen", () => {
  const config: AppConfig = {
    port: 8080,
    timezone: "Europe/Berlin",
    sources: [sutorSource],
    ghostfolio: {
      enabled: true,
      serverUrl: "http://Ghostfolio:3333",
      accountMap: { "riester-1": "account" },
      holdingMap: Object.fromEntries(sutorFundsForTest.map(([symbol, mapped]) => [
        symbol,
        { dataSource: "YAHOO", symbol: mapped, currency: "EUR" }
      ]))
    }
  };
  const preview = new ManualPreviewStore().create(sutorSource, sutorText, config);
  assert.equal(preview.ghostfolioReady, true);
  assert.equal("snapshot" in preview, false);
  assert.doesNotMatch(JSON.stringify(preview), /Raisin-Pension/);
});

const sutorFundsForTest = [
  ["LU1681041627", "MIVA.DE"],
  ["IE00B8KGV557", "EUNZ.DE"],
  ["IE00BKVL7331", "MVEA.DE"],
  ["IE00B8FHGS14", "IQQ0.DE"],
  ["IE00B86MWN23", "EUN0.DE"],
  ["IE00BL25JN58", "XDEB.DE"]
];
