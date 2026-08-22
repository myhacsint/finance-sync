import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FinanceDatabase } from "./database.js";
import type { AppConfig } from "./types.js";
import { buildDashboardAssets, readGhostfolioAssets } from "./dashboard-assets.js";

const config: AppConfig = {
  port: 8080,
  timezone: "Europe/Berlin",
  sources: [
    { id: "dkb-giro", kind: "enable-banking", enabled: true },
    { id: "comdirect-giro", kind: "enable-banking", enabled: true },
    { id: "dkb-depots", kind: "dkb-fints", enabled: true },
    { id: "solana", kind: "solana", enabled: true },
    { id: "sutor-riester", kind: "manual", enabled: true }
  ],
  ghostfolio: {
    enabled: true,
    serverUrl: "http://ghostfolio:3333",
    accountMap: {
      "depot-private": "gf-depot-private",
      "wallet": "gf-wallet",
      "riester": "gf-riester"
    }
  }
};

function database(): FinanceDatabase {
  const db = new FinanceDatabase(join(mkdtempSync(join(tmpdir(), "assets-db-")), "finance.sqlite"));
  for (const source of config.sources) {
    db.registerSource(source.id, source.kind, source.enabled);
    const run = db.beginRun(source.id);
    db.finishRun(run, source.id, source.kind === "manual" ? "WAITING_FOR_USER" : "SUCCESS", "ok");
  }
  db.importBalances([
    { sourceId: "dkb-giro", accountId: "cash-shared", capturedAt: "2026-08-11T08:00:00Z", amountMinor: 1_200_000n, currency: "EUR", owner: "Person A, Person B", rawHash: "cash-one" },
    { sourceId: "comdirect-giro", accountId: "cash-private", capturedAt: "2026-08-11T08:05:00Z", amountMinor: 600_000n, currency: "EUR", owner: "Person A", rawHash: "cash-two" },
    { sourceId: "dkb-depots", accountId: "depot-private", capturedAt: "2026-08-10T08:10:00Z", amountMinor: 3_400_000n, currency: "EUR", owner: "Person A", rawHash: "depot" },
    { sourceId: "solana", accountId: "wallet", capturedAt: "2026-08-11T08:15:00Z", amountMinor: 100n, currency: "LAMPORT", owner: "Person A", rawHash: "solana" },
    { sourceId: "sutor-riester", accountId: "riester", capturedAt: "2026-07-17T22:00:00Z", amountMinor: 7_200_000n, currency: "EUR", owner: "Person A", rawHash: "sutor" }
  ]);
  return db;
}

test("Vermögen wird ohne Kontonummern aus letzten Beständen und Ghostfolio aufgebaut", () => {
  const result = buildDashboardAssets(database(), config, {
    status: "fulfilled",
    value: {
      capturedAt: "2026-08-11T08:30:00Z",
      valuesByAccount: {
        "depot-private": 3_500_000,
        wallet: 1_400_000,
        riester: 7_300_000
      }
    }
  }, new Date("2026-08-11T09:00:00Z"));
  assert.equal(result.state, "current");
  assert.equal(result.totalMinor, 14_000_000);
  assert.deepEqual(result.areas.map((area) => [area.key, area.amountMinor]), [
    ["cash", 1_800_000],
    ["depots", 3_500_000],
    ["pensions", 7_300_000],
    ["crypto", 1_400_000]
  ]);
  assert.deepEqual(result.positions.map((position) => position.label), [
    "comdirect Giro privat",
    "DKB Giro gemeinschaftlich",
    "DKB Depot privat",
    "Riester",
    "Solana & Staking"
  ]);
  assert.equal(result.positions.some((position) => /cash-shared|depot-private|wallet/.test(position.key)), false);
  assert.equal(result.summary.confirmed, 1);
  const pension = result.positions.find((position) => position.area === "pensions");
  assert.equal(pension?.amountMinor, 7_300_000);
  assert.equal(pension?.basis, "Ghostfolio-Marktwert");
  assert.equal(pension?.capturedAt, "2026-08-11T08:30:00Z");
  assert.equal(pension?.confirmedAmountMinor, 7_200_000);
  assert.equal(pension?.confirmedAt, "2026-07-17T22:00:00Z");
  assert.equal(pension?.status, "current");
});

test("fehlende Ghostfolio-Werte lassen Liquidität sichtbar und Gesamtwert offen", () => {
  const result = buildDashboardAssets(database(), config, {
    status: "rejected",
    reason: new Error("offline")
  }, new Date("2026-08-11T09:00:00Z"));
  assert.equal(result.state, "partial");
  assert.equal(result.totalMinor, null);
  assert.equal(result.areas.find((area) => area.key === "cash")?.amountMinor, 1_800_000);
  assert.equal(result.areas.find((area) => area.key === "depots")?.amountMinor, null);
  assert.match(result.warnings.join(" "), /Gesamtwert/);
});

test("Ghostfolio-Konten werden auf FinanceSync-Konten abgebildet", async () => {
  const requests: string[] = [];
  const snapshot = await readGhostfolioAssets(config.ghostfolio!, {
    securityToken: "security-token",
    fetcher: async (input) => {
      const url = String(input);
      requests.push(url);
      return url.endsWith("/auth/anonymous")
        ? new Response(JSON.stringify({ authToken: "bearer" }), { status: 200 })
        : new Response(JSON.stringify({
            createdAt: "2026-08-11T08:30:00Z",
            accounts: {
              "gf-depot-private": { valueInBaseCurrency: 35000.129 },
              "gf-wallet": { valueInBaseCurrency: 14000 },
              "gf-riester": { valueInBaseCurrency: 73000 }
            }
          }), { status: 200 });
    }
  });
  assert.deepEqual(requests.map((url) => new URL(url).pathname), [
    "/api/v1/auth/anonymous",
    "/api/v1/portfolio/details"
  ]);
  assert.equal(snapshot.valuesByAccount["depot-private"], 3_500_013);
});

test("physisches Gold wird separat und ohne Ghostfolio-Doppelzählung ausgewiesen", () => {
  const goldConfig: AppConfig = {
    ...config,
    physicalAssets: [{
      id: "gold-100g",
      label: "Goldbarren 100 g",
      kind: "gold",
      weightGrams: 100,
      fineness: 999.9,
      acquiredYear: 2015,
      acquisitionCostMinor: 350_000,
      acquisitionCostEstimated: true,
      valuations: [{
        date: "2026-08-22",
        amountMinor: 1_245_000,
        basis: "Händler-Ankaufspreis",
        source: "GOLD.DE Ankaufspreisvergleich",
        estimated: true
      }]
    }]
  };
  const result = buildDashboardAssets(database(), goldConfig, {
    status: "fulfilled",
    value: {
      capturedAt: "2026-08-22T08:30:00Z",
      valuesByAccount: {
        "depot-private": 3_500_000,
        wallet: 1_400_000,
        riester: 7_300_000
      }
    }
  }, new Date("2026-08-22T09:00:00Z"));
  assert.equal(result.totalMinor, 15_245_000);
  assert.deepEqual(result.areas.at(-1), {
    key: "precious-metals",
    label: "Edelmetalle",
    amountMinor: 1_245_000,
    percent: 8.17,
    positions: 1,
    status: "confirmed"
  });
  const gold = result.positions.find((position) => position.area === "precious-metals");
  assert.equal(gold?.basis, "Ankaufwert [SCHÄTZUNG]");
  assert.equal(gold?.acquisitionCostMinor, 350_000);
  assert.equal(gold?.valuationSource, "GOLD.DE Ankaufspreisvergleich");
  assert.match(gold?.detail ?? "", /100 g.*999,9/);
});
