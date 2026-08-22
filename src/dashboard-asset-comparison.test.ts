import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FinanceDatabase } from "./database.js";
import type { AppConfig } from "./types.js";
import {
  buildOverviewAssetComparison,
  lastCompletedMonthEnd,
  readCoinGeckoSolPrice
} from "./dashboard-asset-comparison.js";

const config: AppConfig = {
  port: 8080,
  timezone: "Europe/Berlin",
  sources: [
    { id: "dkb-giro", kind: "enable-banking", enabled: true },
    { id: "comdirect-giro", kind: "enable-banking", enabled: true },
    { id: "dkb-depots", kind: "dkb-fints", enabled: true },
    { id: "solana", kind: "solana", enabled: true },
    { id: "sutor-riester", kind: "manual", enabled: true }
  ]
};

function database(): FinanceDatabase {
  const db = new FinanceDatabase(join(mkdtempSync(join(tmpdir(), "comparison-db-")), "finance.sqlite"));
  db.importBalances([
    { sourceId: "dkb-giro", accountId: "cash-one", capturedAt: "2026-07-31T19:00:00Z", amountMinor: 1_500_000n, currency: "EUR", rawHash: "cash-old-one" },
    { sourceId: "comdirect-giro", accountId: "cash-two", capturedAt: "2026-07-31T19:05:00Z", amountMinor: 200_000n, currency: "EUR", rawHash: "cash-old-two" },
    { sourceId: "dkb-depots", accountId: "depot", capturedAt: "2026-07-30T08:00:00Z", amountMinor: 3_000_000n, currency: "EUR", rawHash: "depot-old" },
    { sourceId: "sutor-riester", accountId: "riester", capturedAt: "2026-07-17T22:00:00Z", amountMinor: 7_200_000n, currency: "EUR", rawHash: "pension-old" },
    { sourceId: "dkb-giro", accountId: "cash-one", capturedAt: "2026-08-10T08:00:00Z", amountMinor: 1_600_000n, currency: "EUR", rawHash: "cash-new-one" },
    { sourceId: "comdirect-giro", accountId: "cash-two", capturedAt: "2026-08-10T08:05:00Z", amountMinor: 225_900n, currency: "EUR", rawHash: "cash-new-two" },
    { sourceId: "dkb-depots", accountId: "depot", capturedAt: "2026-08-10T08:10:00Z", amountMinor: 3_400_000n, currency: "EUR", rawHash: "depot-new" }
  ]);
  db.importHoldings([
    { sourceId: "solana", accountId: "wallet", capturedAt: "2026-07-31T20:00:00Z", symbol: "SOL", quantityAtomic: "10000000000", atomicDecimals: 9, rawHash: "sol-old" },
    { sourceId: "solana", accountId: "wallet", capturedAt: "2026-07-31T20:00:00Z", symbol: "SOL-STAKED", quantityAtomic: "2000000000", atomicDecimals: 9, rawHash: "sol-old" },
    { sourceId: "solana", accountId: "wallet", capturedAt: "2026-08-10T08:15:00Z", symbol: "SOL", quantityAtomic: "10100000000", atomicDecimals: 9, rawHash: "sol-new" },
    { sourceId: "solana", accountId: "wallet", capturedAt: "2026-08-10T08:15:00Z", symbol: "SOL-STAKED", quantityAtomic: "2050000000", atomicDecimals: 9, rawHash: "sol-new" }
  ]);
  db.importActivities([{
    sourceId: "solana",
    sourceActivityId: "reward-one",
    accountId: "stake-account",
    occurredAt: "2026-07-20T10:00:00Z",
    type: "STAKING_REWARD",
    symbol: "SOL",
    quantityAtomic: "50000000",
    atomicDecimals: 9,
    rawHash: "reward"
  }]);
  return db;
}

const current = {
  totalMinor: 18_002_500,
  cashMinor: 1_825_900,
  investmentMinor: 16_176_600,
  allocation: [
    { key: "pensions" as const, amountMinor: 11_370_000 },
    { key: "depots" as const, amountMinor: 3_410_000 },
    { key: "solana" as const, amountMinor: 1_396_600 }
  ]
};

test("letztes vollständiges Monatsende berücksichtigt Europe/Berlin", () => {
  assert.deepEqual(
    lastCompletedMonthEnd(new Date("2026-08-14T12:00:00Z"), "Europe/Berlin"),
    { effectiveDate: "2026-07-31", endExclusive: "2026-07-31T22:00:00.000Z" }
  );
});

test("Monatsvergleich trennt belegte Anteile und markiert SOL-Nachbewertung", () => {
  const db = database();
  try {
    const result = buildOverviewAssetComparison(db, config, current, {
      status: "fulfilled",
      value: { date: "2026-07-31", priceMinor: 10_000, source: "CoinGecko" }
    }, new Date("2026-08-14T12:00:00Z"));
    assert.equal(result.state, "complete");
    assert.equal(result.previousTotalMinor, 12_020_000);
    assert.equal(result.changeTotalMinor, 5_982_500);
    assert.deepEqual(result.parts.map((part) => [part.key, part.previousMinor, part.valuation]), [
      ["cash", 1_700_000, "measured"],
      ["depots", 3_000_000, "measured"],
      ["pensions", 7_200_000, "confirmed"],
      ["solana", 120_000, "estimated"]
    ]);
    const solana = result.parts.find((part) => part.key === "solana");
    assert.equal(solana?.quantity, 12);
    assert.equal(solana?.stakingRewardsQuantity, 0.05);
    assert.equal(solana?.priceDate, "2026-07-31");
  } finally {
    db.close();
  }
});

test("fehlender SOL-Tageskurs verhindert nur die scheinpräzise Gesamtsumme", () => {
  const db = database();
  try {
    const result = buildOverviewAssetComparison(db, config, current, {
      status: "rejected",
      reason: new Error("offline")
    }, new Date("2026-08-14T12:00:00Z"));
    assert.equal(result.state, "partial");
    assert.equal(result.previousTotalMinor, null);
    assert.equal(result.changeTotalMinor, null);
    assert.equal(result.parts.find((part) => part.key === "cash")?.changeMinor, 125_900);
    assert.equal(result.parts.find((part) => part.key === "solana")?.previousMinor, null);
    assert.equal(result.parts.find((part) => part.key === "solana")?.valuation, "unavailable");
  } finally {
    db.close();
  }
});

test("CoinGecko-Tageskurs wird für den exakten Stichtag in EUR gelesen", async () => {
  let requested = "";
  const result = await readCoinGeckoSolPrice("2026-07-31", {
    fetcher: async (input) => {
      requested = String(input);
      return Response.json({ market_data: { current_price: { eur: 153.456 } } });
    }
  });
  const url = new URL(requested);
  assert.equal(url.pathname, "/api/v3/coins/solana/history");
  assert.equal(url.searchParams.get("date"), "31-07-2026");
  assert.equal(url.searchParams.get("localization"), "false");
  assert.deepEqual(result, { date: "2026-07-31", priceMinor: 15_346, source: "CoinGecko" });
});

test("Goldvergleich verwendet nur dokumentierte Bewertungen und stimmt die Gesamtsumme ab", () => {
  const db = database();
  try {
    const goldConfig: AppConfig = {
      ...config,
      physicalAssets: [{
        id: "gold-100g",
        label: "Goldbarren 100 g",
        kind: "gold",
        weightGrams: 100,
        fineness: 999.9,
        valuations: [
          { date: "2026-07-31", amountMinor: 1_127_800, basis: "XAU/EUR", source: "Historischer Goldkurs", estimated: true },
          { date: "2026-08-22", amountMinor: 1_245_000, basis: "Ankauf", source: "GOLD.DE", estimated: true }
        ]
      }]
    };
    const goldCurrent = {
      ...current,
      totalMinor: current.totalMinor + 1_245_000,
      investmentMinor: current.investmentMinor + 1_245_000,
      allocation: [...current.allocation, { key: "gold" as const, amountMinor: 1_245_000 }]
    };
    const result = buildOverviewAssetComparison(db, goldConfig, goldCurrent, {
      status: "fulfilled",
      value: { date: "2026-07-31", priceMinor: 10_000, source: "CoinGecko" }
    }, new Date("2026-08-22T09:00:00Z"));
    assert.equal(result.state, "complete");
    assert.equal(result.previousTotalMinor, 13_147_800);
    assert.equal(result.changeTotalMinor, 6_099_700);
    assert.deepEqual(result.parts.at(-1), {
      key: "gold",
      label: "Physisches Gold",
      currentMinor: 1_245_000,
      previousMinor: 1_127_800,
      changeMinor: 117_200,
      source: "Historischer Goldkurs",
      capturedDates: ["2026-07-31"],
      valuation: "estimated"
    });
  } finally {
    db.close();
  }
});
