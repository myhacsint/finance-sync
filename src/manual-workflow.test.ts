import test from "node:test";
import assert from "node:assert/strict";
import {
  ManualPreviewStore,
  parseManualWorkflowText,
  supportsLegacyManualWorkflow
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

test("Legacy-Freitext bietet nur weiterhin manuell geführte Quellen an", () => {
  const config: AppConfig = {
    port: 8080,
    timezone: "Europe/Berlin",
    sources: [sutorSource, alteSource],
    ghostfolio: {
      enabled: true,
      serverUrl: "http://Ghostfolio:3333",
      accountMap: { "pension-1": "account" }
    }
  };
  const sources = new ManualPreviewStore().listSources(config);
  assert.deepEqual(sources.map((source) => source.id), ["alte-leipziger"]);
  assert.equal(supportsLegacyManualWorkflow(sutorSource), false);
  assert.equal(supportsLegacyManualWorkflow(alteSource), true);
  assert.throws(() => parseManualWorkflowText(sutorSource, alteText), /Vorsorge-Konfiguration/);
  const preview = new ManualPreviewStore().create(alteSource, alteText, config);
  assert.equal(preview.holdings.length, 7);
  assert.equal("snapshot" in preview, false);
  assert.doesNotMatch(JSON.stringify(preview), /Rente mit Fondsanlage/);
});
