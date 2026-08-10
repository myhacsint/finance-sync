import assert from "node:assert/strict";
import test from "node:test";
import { renderUi } from "./ui.js";

test("Datenstatus enthält responsive Navigation und zugängliche Hauptbereiche", () => {
  const html = renderUi();
  assert.match(html, /<main class="content" id="main-content">/);
  assert.match(html, /aria-label="Mobile Hauptnavigation"/);
  assert.match(html, /Gesamtvermögen/);
  assert.match(html, /Geldfluss/);
  assert.match(html, /Vermögensaufteilung/);
  assert.match(html, /Aufteilung teilweise nicht verfügbar/);
  assert.match(html, /Datenbasis/);
  assert.match(html, /\/api\/dashboard\/overview/);
  assert.match(html, /Datenstatus/);
  assert.match(html, /Offene Aufgaben/);
  assert.match(html, /Automatische Quellen/);
  assert.match(html, /Systemzustand/);
  assert.match(html, /\/api\/dashboard\/status/);
});

test("Übersicht und Datenstatus sind als tiefe Links erreichbar", () => {
  const html = renderUi();
  assert.match(html, /#\/overview/);
  assert.match(html, /#\/data-status/);
  assert.match(html, /window\.addEventListener\("hashchange"/);
  assert.match(html, /href="#\/data-status"/);
});

test("Verwaltungstoken bleibt nur für die Browsersitzung gespeichert", () => {
  const html = renderUi();
  assert.match(html, /sessionStorage\.setItem\("financeToken"/);
  assert.match(html, /localStorage\.removeItem\("financeToken"\)/);
  assert.doesNotMatch(html, /localStorage\.setItem\("financeToken"/);
});
