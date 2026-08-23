import assert from "node:assert/strict";
import test from "node:test";
import { createLifeEvent, lifeEventMonthlyDelta } from "./life-events.js";

test("Ereignis wirkt erst ab Startmonat", () => {
  const event = createLifeEvent("Krippe endet", "2027-08", 80_000, new Date("2026-08-23T12:00:00Z"));
  assert.equal(lifeEventMonthlyDelta([event], "2027-07"), 0);
  assert.equal(lifeEventMonthlyDelta([event], "2027-08"), 80_000);
  assert.equal(lifeEventMonthlyDelta([event], "2028-01"), 80_000);
});
