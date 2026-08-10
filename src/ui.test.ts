import assert from "node:assert/strict";
import test from "node:test";
import { renderUi } from "./ui.js";

test("Datenstatus enthält responsive Navigation und zugängliche Hauptbereiche", () => {
  const html = renderUi();
  assert.match(html, /<main class="content" id="main-content">/);
  assert.match(html, /aria-label="Mobile Hauptnavigation"/);
  assert.match(html, /Datenstatus/);
  assert.match(html, /Offene Aufgaben/);
  assert.match(html, /Automatische Quellen/);
  assert.match(html, /Systemzustand/);
  assert.match(html, /\/api\/dashboard\/status/);
});

test("Verwaltungstoken bleibt nur für die Browsersitzung gespeichert", () => {
  const html = renderUi();
  assert.match(html, /sessionStorage\.setItem\("financeToken"/);
  assert.match(html, /localStorage\.removeItem\("financeToken"\)/);
  assert.doesNotMatch(html, /localStorage\.setItem\("financeToken"/);
});
