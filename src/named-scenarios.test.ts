import assert from "node:assert/strict";
import test from "node:test";
import { createNamedScenario, parseNamedScenario } from "./named-scenarios.js";

test("benannte Szenarien speichern nur den Laborzustand", () => {
  const saved = createNamedScenario("Krippe endet", {
    trendBasis: "current-year",
    realReturnBps: 300,
    monthlyChangeMinor: 50_000,
    oneTimeMinor: -200_000,
    fireTargetAge: 60,
    fireActionKeys: ["recurring-aaaaaaaaaaaaaaaaaa"],
    fireCategoryCuts: ["category-aaaaaaaaaa:25"],
    fireOneTimeKeys: []
  }, new Date("2026-08-23T18:00:00.000Z"));
  assert.match(saved.id, /^scenario-[a-f0-9]{16}$/);
  assert.equal(saved.name, "Krippe endet");
  assert.equal(saved.inputs.monthlyChangeMinor, 50_000);
  assert.equal(saved.inputs.fireTargetAge, 60);
  assert.equal(parseNamedScenario(saved).name, "Krippe endet");
});

test("leerer Szenarioname wird abgelehnt", () => {
  assert.throws(() => createNamedScenario("  ", {}), /Name fehlt/);
});
