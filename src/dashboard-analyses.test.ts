import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardAnalyses, analysesSelection } from "./dashboard-analyses.js";
import type { ActualSpendingRangeSnapshot, SpendingLine } from "./dashboard-spending.js";
import type { AppConfig } from "./types.js";

const config: AppConfig = {
  port: 8080,
  timezone: "Europe/Berlin",
  sources: [],
  analysis: {
    expenseStructure: {
      oldestYear: 2024,
      overrides: [
        { merchantContains: "mammotion", categoryEquals: "Haushalt & Reparaturen", class: "DISPOSITIV" }
      ],
      adjustments: [
        {
          id: "company-car",
          label: "Firmenwagen",
          category: "Auto & Kraftstoff",
          class: "STRUKTURELL",
          year: 2025,
          amountMinor: 951_987
        },
        {
          id: "health-subsidy",
          label: "Arbeitgeberzuschuss Krankenversicherung",
          category: "Versicherungen",
          class: "VERTRAGLICH",
          year: 2025,
          amountMinor: -608_640
        },
        {
          id: "company-car-comparison",
          label: "Firmenwagen",
          category: "Auto & Kraftstoff",
          class: "STRUKTURELL",
          year: 2024,
          amountMinor: 951_987,
          estimate: true
        }
      ]
    }
  }
};

function line(
  id: string,
  date: string,
  merchant: string,
  categoryLabel: string,
  amountMinor: number
): SpendingLine {
  return {
    id,
    date,
    merchantKey: `merchant-${id}`,
    merchant,
    notes: "",
    accountKey: "account",
    accountLabel: "Giro",
    categoryKey: `category-${id}`,
    categoryLabel,
    categorized: true,
    amountMinor
  };
}

function privateLine(
  id: string,
  date: string,
  displayMerchant: string,
  categoryLabel: string,
  amountMinor: number
): SpendingLine {
  return {
    ...line(id, date, "Private Gegenpartei", categoryLabel, amountMinor),
    displayMerchant
  };
}

function snapshot(lines: SpendingLine[]): ActualSpendingRangeSnapshot {
  return {
    startDate: "2024-01-01",
    endDate: "2025-12-31",
    generatedAt: "2026-08-11T08:00:00.000Z",
    lines,
    accounts: [{ key: "account", label: "Giro" }]
  };
}

test("Standardauswahl ist das letzte volle Kalenderjahr", () => {
  assert.deepEqual(
    analysesSelection(config, new Date("2026-08-11T08:00:00Z")),
    {
      periodYear: 2025,
      comparisonYear: 2024,
      availableYears: [2026, 2025, 2024],
      completedMonths: 7
    }
  );
});

test("2025 wird mit Zusatzwerten exakt und ohne Sparen reconciliert", () => {
  const data = buildDashboardAnalyses(snapshot([
    line("insurance", "2025-02-01", "Versicherung AG", "Versicherungen", 2_713_677),
    line("children", "2025-03-01", "Schulservice GmbH", "Kinder", 965_727),
    line("food", "2025-04-01", "Lidl Sagt Danke", "Lebensmittel", 3_038_367),
    line("it", "2025-05-01", "Technik-Shop GmbH", "Homelab & IT", 1_824_989),
    line("unknown", "2025-06-01", "Unbekannter Händler", "Sonstige Ausgaben", 2_531_966),
    line("saving", "2025-07-01", "Depot", "Sparen & Investieren", -265_134),
    line("refund", "2025-08-01", "Lidl Sagt Danke", "Lebensmittel", -10_000),
    line("expense", "2025-08-02", "Lidl Sagt Danke", "Lebensmittel", 10_000),
    line("previous", "2024-01-01", "Supermarkt", "Lebensmittel", 1_000_000)
  ]), config, 2025, 2024, new Date("2026-08-11T08:00:00Z"));

  assert.equal(data.period.totalMinor, 11_418_073);
  assert.deepEqual(data.classes.map((row) => [row.key, row.amountMinor]), [
    ["VERTRAGLICH", 2_105_037],
    ["STRUKTURELL", 1_917_714],
    ["GRUNDBEDARF", 3_038_367],
    ["DISPOSITIV", 1_824_989],
    ["UNBEKANNT", 2_531_966]
  ]);
  assert.equal(data.classes.reduce((sum, row) => sum + row.amountMinor, 0), data.period.totalMinor);
  for (const category of data.categories) {
    assert.equal(
      category.periodTransactions.reduce((sum, row) => sum + row.amountMinor, 0),
      category.periodMinor
    );
    assert.equal(
      category.comparisonTransactions.reduce((sum, row) => sum + row.amountMinor, 0),
      category.comparisonMinor
    );
    assert.deepEqual(
      category.periodTransactions.map((row) => row.amountMinor),
      category.periodTransactions.map((row) => row.amountMinor).sort((left, right) => right - left)
    );
  }
  assert.equal(data.unknownPercent, 22.2);
  assert.equal(data.positions.find((row) => row.label === "Firmenwagen")?.amountMinor, 951_987);
  assert.equal(data.positions.find((row) => row.label === "Lebensmittelhandel")?.amountMinor, 3_038_367);
  const homelab = data.categories.find((row) => row.label === "Homelab & IT")!;
  assert.deepEqual(homelab.periodTransactions.map((row) => [
    row.date,
    row.merchant,
    row.amountMinor,
    row.estimate
  ]), [["2025-05-01", "Technik-Shop GmbH", 1_824_989, false]]);
  assert.match(homelab.periodTransactions[0].key, /^booking-[a-f0-9]{14}$/);
  assert.deepEqual(homelab.comparisonTransactions, []);
  assert.equal(data.comparison.estimate, true);
  assert.equal(data.state, "current");
});

test("authentifizierte Buchungsdetails zeigen private Gegenparteien ohne technische Kennungen", () => {
  const data = buildDashboardAnalyses(snapshot([
    privateLine("private-payment", "2025-03-12", "Max Mustermann", "Freizeit & Hobbys", 12_500)
  ]), config, 2025, 2024, new Date("2026-08-11T08:00:00Z"));
  const category = data.categories.find((row) => row.label === "Freizeit & Hobbys");
  assert.equal(category?.periodTransactions[0]?.merchant, "Max Mustermann");
  assert.match(category?.periodTransactions[0]?.key ?? "", /^booking-[a-f0-9]{14}$/);
  assert.doesNotMatch(JSON.stringify(category?.periodTransactions), /private-payment/);
});

test("lokale Händlerausnahme korrigiert die Klasse ohne den Betrag zu ändern", () => {
  const overrideOnly: AppConfig = {
    ...config,
    analysis: {
      expenseStructure: {
        oldestYear: 2024,
        overrides: [{ merchantContains: "mammotion", categoryEquals: "Haushalt & Reparaturen", class: "DISPOSITIV" }]
      }
    }
  };
  const data = buildDashboardAnalyses(snapshot([
    line("garden", "2025-06-01", "Mammotion Store", "Haushalt & Reparaturen", 109_900)
  ]), overrideOnly, 2025, 2024, new Date("2026-08-11T08:00:00Z"));
  assert.equal(data.period.totalMinor, 109_900);
  assert.equal(data.classes.find((row) => row.key === "DISPOSITIV")?.amountMinor, 109_900);
  assert.equal(data.classes.find((row) => row.key === "GRUNDBEDARF")?.amountMinor, 0);
});
