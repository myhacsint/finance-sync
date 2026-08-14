import assert from "node:assert/strict";
import test from "node:test";
import { renderUi } from "./ui.js";

test("Datenstatus enthält responsive Navigation und zugängliche Hauptbereiche", () => {
  const html = renderUi();
  assert.match(html, /<main class="content" id="main-content">/);
  assert.match(html, /aria-label="Mobile Hauptnavigation"/);
  assert.match(html, /Gesamtvermögen/);
  assert.match(html, /Monatsvergleich/);
  assert.match(html, /Gesamtvergleich offen/);
  assert.match(html, /Unvollständige Anteile werden nicht summiert/);
  assert.match(html, /Vergleichswert/);
  assert.match(html, /part\.source/);
  assert.match(html, /erkannte Staking-Erträge enthalten/);
  assert.match(html, /\[SCHÄTZUNG\]/);
  assert.match(html, /Geldfluss/);
  assert.match(html, /Vermögensaufteilung/);
  assert.match(html, /Aufteilung teilweise nicht verfügbar/);
  assert.match(html, /Datenbasis/);
  assert.match(html, /\/api\/dashboard\/overview/);
  assert.match(html, /cashflowMonths/);
  assert.match(html, /cashflowOffset/);
  assert.match(html, /spendingOffset/);
  assert.match(html, />4 Monate</);
  assert.match(html, />6 Monate</);
  assert.match(html, />12 Monate</);
  assert.match(html, /Einen Monat zurück/);
  assert.match(html, /Einen Monat vor/);
  assert.match(html, /Vollständige Monate/);
  assert.match(html, /Angezeigter Ausgabenmonat/);
  assert.match(html, /Einen Ausgabenmonat zurück/);
  assert.match(html, /Einen Ausgabenmonat vor/);
  assert.match(html, /Datenstatus/);
  assert.match(html, /Offene Aufgaben/);
  assert.match(html, /Automatische Quellen/);
  assert.match(html, /Systemzustand/);
  assert.match(html, /\/api\/dashboard\/status/);
});

test("Übersicht und Datenstatus sind als tiefe Links erreichbar", () => {
  const html = renderUi();
  assert.match(html, /#\/overview/);
  assert.match(html, /#\/spending/);
  assert.match(html, /#\/data-status/);
  assert.match(html, /window\.addEventListener\("hashchange"/);
  assert.match(html, /window\.addEventListener\("popstate"/);
  assert.match(html, /href="#\/data-status"/);
  assert.match(html, /href="#\/spending">Alle Ausgaben ansehen/);
});

test("Ausgabenansicht besitzt Navigation, Filter, Pagination und mobile Buchungen", () => {
  const html = renderUi();
  assert.match(html, /\/api\/dashboard\/spending/);
  assert.match(html, /expenseMonth/);
  assert.match(html, /expenseCategory/);
  assert.match(html, /expenseAccount/);
  assert.match(html, /expenseSearch/);
  assert.match(html, /expenseCategorySearch/);
  assert.match(html, /expenseCategoriesExpanded/);
  assert.match(html, /expensePage/);
  assert.match(html, /Kategorie suchen …/);
  assert.match(html, /Händler oder Buchung suchen …/);
  assert.match(html, /Alle Konten/);
  assert.match(html, /expense-pagination/);
  assert.match(html, /expense-mobile-list/);
  assert.match(html, /Kategorisiert/);
  assert.match(html, /new Intl\.DateTimeFormat\("de-DE",\{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"\}\)/);
});

test("Vermögensansicht besitzt Aufteilung, Bereichsfilter und mobile Bestände", () => {
  const html = renderUi();
  assert.match(html, /#\/assets/);
  assert.match(html, /#\/analyses/);
  assert.match(html, /\/api\/dashboard\/assets/);
  assert.match(html, /assets-summary/);
  assert.match(html, /assets-bar/);
  assert.match(html, /assetArea/);
  assert.match(html, /Vermögensbereiche/);
  assert.match(html, /Bestände/);
  assert.match(html, /assets-table/);
  assert.match(html, /assets-mobile-list/);
  assert.match(html, /Basis: letzte verfügbare Werte/);
  assert.match(html, /Konten, Anlagen und Vorsorge mit nachvollziehbaren Stichtagen/);
});

test("Analysenansicht besitzt Jahresvergleich, Schätzungsmarker, Drilldown und CSV-Export", () => {
  const html = renderUi();
  assert.match(html, /\/api\/dashboard\/analyses/);
  assert.match(html, /Ausgaben verstehen und Veränderungen nachvollziehen/);
  assert.match(html, /analysisPeriod/);
  assert.match(html, /analysisComparison/);
  assert.match(html, /analysisPosition/);
  assert.match(html, /Ausgaben nach Kategorie/);
  assert.match(html, /Ausgabenklassen/);
  assert.match(html, /Größte Positionen/);
  assert.match(html, /\[SCHÄTZUNG\]/);
  assert.match(html, /CSV exportieren/);
  assert.match(html, /analysis-mobile-positions/);
});

test("Verwaltungstoken bleibt nur für die Browsersitzung gespeichert", () => {
  const html = renderUi();
  assert.match(html, /id="token-form"/);
  assert.match(html, /id="token-input" type="password"/);
  assert.match(html, /function submitToken\(event\)/);
  assert.doesNotMatch(html, /prompt\(/);
  assert.match(html, /sessionStorage\.setItem\("financeToken"/);
  assert.match(html, /localStorage\.removeItem\("financeToken"\)/);
  assert.doesNotMatch(html, /localStorage\.setItem\("financeToken"/);
});
