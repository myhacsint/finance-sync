import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderUi as renderShell } from "./ui.js";

const clientSource = readFileSync(new URL("../assets/app.js", import.meta.url), "utf8");
const stylesheetSource = readFileSync(new URL("../assets/app.css", import.meta.url), "utf8");
function renderUi(): string {
  return `${renderShell()}\n${clientSource}\n${stylesheetSource}`;
}

test("externes UI-JavaScript ist syntaktisch gültig", () => {
  assert.match(renderShell(), /<script src="\/assets\/app\.js\?v=0\.43\.2" defer><\/script>/);
  assert.match(clientSource, /match\(\/\^\(\\d\{4\}\)-\(\\d\{2\}\)\$\//);
  assert.doesNotThrow(() => new Function(clientSource));
});

test("Prüfansicht behält 24 Monate und schützt Schreibaktionen", () => {
  const html = renderUi();
  assert.match(html, /\[3,6,12,24\]\.includes\(months\)/);
  assert.match(html, /id="miles-import-button"[^>]*disabled/);
  assert.match(html, /id="miles-confirm-check"/);
  assert.match(html, /currentMilesMorePreview/);
  assert.match(html, /rule\.deletable/);
  assert.match(html, />Standard<\/span>/);
});

test("gespeicherte Szenarien stellen alle FIRE-Hebel vollständig wieder her", () => {
  const html = renderUi();
  assert.match(html, /params\.set\("fireActionKeys","none"\)/);
  assert.match(html, /inputs\.fireCategoryCuts/);
  assert.match(html, /params\.set\("fireCategoryCuts"/);
  assert.match(html, /inputs\.fireOneTimeKeys/);
  assert.match(html, /params\.set\("fireOneTimeKeys"/);
});

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
  assert.match(html, /#\/review/);
  assert.match(html, /#\/decision-lab/);
  assert.match(html, /#\/data-status/);
  assert.match(html, /window\.addEventListener\("hashchange"/);
  assert.match(html, /window\.addEventListener\("popstate"/);
  assert.match(html, /href="#\/data-status"/);
  assert.match(html, /href="\?expenseMonth=.*#\/spending">.*im Detail ansehen/);
  assert.match(stylesheetSource, /\.wealth-comparison > summary > svg \{ width: 18px; height: 18px;/);
});

test("Ausgabenansicht besitzt Navigation, Filter, Pagination und mobile Buchungen", () => {
  const html = renderUi();
  assert.match(html, /\/api\/dashboard\/spending/);
  assert.match(html, /expenseMonth/);
  assert.match(html, /expensePeriod/);
  assert.match(html, /toggleExpenseSort/);
  assert.match(html, /setExpensePeriod/);
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
  assert.match(html, /expense-merchant-group/);
  assert.match(html, /Händler und Dienste/);
  assert.match(html, /Arzt brutto/);
  assert.match(html, /Netto \/ Selbstbehalt/);
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
  assert.match(html, /"precious-metals"/);
  assert.doesNotMatch(html, /active\?'all':area\.key/);
  assert.match(html, /Vermögensbereiche/);
  assert.match(html, /Bestände/);
  assert.match(html, /assets-table/);
  assert.match(html, /assets-mobile-list/);
  assert.match(html, /assetHoldingRows/);
  assert.match(html, /assetPerformanceLabel/);
  assert.match(html, /Einstand/);
  assert.match(html, /Dividenden/);
  assert.match(html, /Brutto/);
  assert.match(html, /toggleAssetHoldings/);
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
  assert.match(html, /Größte Veränderungen nach Kategorie/);
  assert.match(html, /Ausgabenklassen/);
  assert.match(html, /Größte Positionen/);
  assert.match(html, /\[SCHÄTZUNG\]/);
  assert.match(html, /CSV exportieren/);
  assert.match(html, /analysis-mobile-positions/);
});

test("Analysenansicht besitzt regelmäßige Ausgaben mit Filtern, Detail und Nutzerentscheidung", () => {
  const html = renderUi();
  assert.match(html, /Regelmäßige Ausgaben prüfen/);
  assert.match(html, /analysisView/);
  assert.match(html, /recurringRhythm/);
  assert.match(html, /recurringReview/);
  assert.match(html, /recurringClassification/);
  assert.match(html, /recurringConfidence/);
  assert.match(html, /recurringCandidate/);
  assert.match(html, /\/api\/dashboard\/analyses\/recurring-expenses/);
  assert.match(html, /\/api\/decisions\/recurring-expenses/);
  assert.match(html, /Mögliche regelmäßige Zahlungen/);
  assert.match(html, /keine Summenbildung vor Bestätigung/);
  assert.match(html, /Rhythmussicherheit/);
  assert.match(html, /Klassifikationssicherheit/);
  assert.match(html, /item\.evidence\.label/);
  assert.match(html, /Grundbedarf/);
  assert.match(html, /Gestaltbar/);
  assert.match(html, /Vermeidbar/);
  assert.match(html, /Kein Kandidat/);
  assert.match(html, /recurring-mobile-list/);
});

test("Analysenansicht besitzt eine konkrete Optimierungsliste", () => {
  const html = renderUi();
  assert.match(html, /Optimierungsliste/);
  assert.match(html, /expense-optimizations/);
  assert.match(html, /recurring-expenses\/optimizations/);
  assert.match(html, /Kündigung \/ Änderung geplant/);
  assert.match(html, /Gekündigt \/ umgesetzt/);
  assert.match(html, /Wirksam ab \/ Enddatum/);
  assert.match(html, /Jährliche Entlastung in €/);
  assert.match(html, /\[SCHÄTZUNG\]/);
  assert.match(html, /Nicht gesetzt/);
});

test("Analysenansicht besitzt ein zugängliches Entscheidungslabor", () => {
  const html = renderUi();
  assert.match(html, /Entscheidungslabor/);
  assert.match(html, /analysisView/);
  assert.match(html, /decisionBasis/);
  assert.match(html, /decisionReturn/);
  assert.match(html, /decisionMonthly/);
  assert.match(html, /decisionOneTime/);
  assert.match(html, /\/api\/dashboard\/analyses\/decision-lab/);
  assert.match(html, /Realrendite pro Jahr/);
  assert.match(html, /Ausgangsbasis/);
  assert.match(html, /trendBasis/);
  assert.match(html, /Einnahmen/);
  assert.match(html, /Ausgaben/);
  assert.match(html, /Aktueller Trend/);
  assert.match(html, /Typischer Monat/);
  assert.match(html, /Aktueller Monat bis heute/);
  assert.match(html, /Jahresausblick/);
  assert.match(html, /Ist-Saldo gegenüber erwartetem Pfad/);
  assert.match(html, /Hochrechnung Jahresende/);
  assert.match(html, /laufender Monat nicht eingerechnet/);
  assert.match(html, /Monatsverlauf anzeigen/);
  assert.match(html, /annual\.months/);
  assert.match(html, /laufender Monat separat/);
  assert.match(html, /vorläufiger offener Stand/);
  assert.match(html, /Einzelkategorien folgen mit der Abrechnung/);
  assert.match(html, /Was in die Monatsbasis einfließt/);
  assert.match(html, /Mitarbeiteraktienvorteil/);
  assert.match(html, /Kapitalerträge · ausgeschlossen/);
  assert.match(html, /Monatliche Veränderung/);
  assert.match(html, /Einmaliger Zu- oder Abfluss/);
  assert.match(html, /Finanzvermögen über 20 Jahre/);
  assert.match(html, /FIRE-Kurs und konkrete Stellschrauben/);
  assert.match(html, /Überbrückungskapital heute/);
  assert.match(html, /Gebundene Vorsorge/);
  assert.match(html, /Erwartet frei mit/);
  assert.match(html, /Benötigtes FIRE-Kapital/);
  assert.match(html, /Kapitallücke/);
  assert.match(html, /Puffer/);
  assert.match(html, /Heutige Kaufkraft · Basisjahr 2026/);
  assert.match(html, /Reale Ausgabenhebel/);
  assert.match(html, /estimatedAnnualCostMinor/);
  assert.match(html, /Mögliche Entlastung erst nach Prüfung/);
  assert.match(html, /Nächste 5 prüfbare Dinge/);
  assert.match(html, /Nur bestätigte laufende Maßnahmen zählen/);
  assert.match(html, /Variable Ausgabenkategorien/);
  assert.match(html, /fireCategoryCuts/);
  assert.match(html, /fire-category-cut/);
  assert.match(html, /Historische Einzelposten/);
  assert.match(html, /Geglättete Jahresbasis/);
  assert.match(html, /Beobachteter Betrag/);
  assert.match(html, /Händler und Dienste ·/);
  assert.match(html, /größte Summe zuerst/);
  assert.match(html, /fire-merchant-group/);
  assert.match(html, /Einzelbuchungen für/);
  assert.match(html, /fireCategoryPeriod/);
  assert.match(html, /fire-booking-row/);
  assert.match(html, /fireOneTimeKeys/);
  assert.match(html, /fire-one-time/);
  assert.match(html, /zählt nicht als Ersparnis/);
  assert.match(html, /fireTargetAge/);
  assert.match(html, /fireActionKeys/);
  assert.match(html, /decision-milestones/);
  assert.match(html, /stroke-dasharray/);
  assert.match(html, /\[SCHÄTZUNG\]/);
});

test("Analysenansicht trennt Kryptoherkunft, Investmentbasis und Steuerprüfung", () => {
  const html = renderUi();
  assert.match(html, /Krypto · Herkunft &amp; Steuerstatus/);
  assert.match(html, /\/api\/dashboard\/analyses\/crypto-position/);
  assert.match(html, /Investmentbasis/);
  assert.match(html, /Bestandszusammensetzung/);
  assert.match(html, /Steuerliche Prüfspur/);
  assert.match(html, /keine steuerliche Cost Basis/);
  assert.match(html, /Keine Steuerschuld/);
  assert.match(html, /crypto-tax-mobile/);
  assert.doesNotMatch(html, /walletAddress|stakeAccountAddress|sourceAddress/i);
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

test("Actual und Ghostfolio sind als sichere Direktlinks erreichbar", () => {
  const html = renderShell("https://homeserver.example:8080");
  assert.match(html, /href="https:\/\/homeserver\.example:5006\/"[^>]+target="_blank"[^>]+>Actual Budget<\/a>/);
  assert.match(html, /href="https:\/\/homeserver\.example:3333\/"[^>]+target="_blank"[^>]+>Ghostfolio<\/a>/);
  assert.doesNotMatch(html, /Direktlink folgt/);
});

test("Prüfen und Labor sind eigene Flächen mit einer Taxonomie", () => {
  const html = renderUi();
  assert.match(html, /label:"Prüfen"/);
  assert.match(html, /label:"Planen"/);
  assert.match(html, /\/api\/dashboard\/review/);
  assert.match(html, /\/api\/dashboard\/review\/transaction/);
  assert.match(html, /Eine Taxonomie/);
  assert.match(html, /In Actual speichern/);
  assert.match(html, /Ausgaben ohne Kategorie/);
  assert.match(html, /review-booking-list/);
  assert.match(stylesheetSource, /\.review-booking \{[^}]*border:/);
  assert.match(html, /Einnahmen ohne Kategorie/);
  assert.match(html, /Händler bündeln als/);
  assert.match(html, /function renderReview\(/);
  assert.ok(html.includes('#/review'));
  assert.ok(html.includes('#/decision-lab'));
  assert.match(html, /lab-nav/);
  assert.match(html, /setLabView/);
  assert.match(html, /setReviewMonths/);
  assert.match(html, /FIRE-Kurs/);
  assert.match(html, /Jahresausblick/);
  assert.match(html, /Nächste 5 prüfbare Dinge/);
  assert.match(html, /zählt nicht ins Szenario/);
  assert.match(html, /Plan vs\. Ist/);
  assert.match(html, /Cashflow-Modell/);
  assert.match(html, /nur dieses Modell/);
  assert.match(html, /Szenario speichern/);
  assert.match(html, /\/api\/dashboard\/scenarios/);
  assert.match(html, /Modellzahlen sind Schätzungen/);
  assert.match(html, /function saveNamedScenario\(/);
  assert.match(html, /24 Monate/);
  assert.match(html, /Miles/);
  assert.match(html, /Händlerregeln/);
  assert.match(html, /Monat abschließen/);
  assert.match(html, /saveLifeEvent/);
  assert.match(html, /compareNamedScenarios/);
  assert.match(html, /fire-gap-title/);
});

test("alte Analyse-URLs landen auf Prüfen oder Labor", () => {
  const html = renderUi();
  assert.match(html, /function migrateLegacyRoutes\(/);
  assert.match(html, /params\.get\("analysisView"\)/);
  assert.match(html, /view==="decision-lab"/);
  assert.match(html, /view==="recurring-expenses"/);
  assert.match(html, /view==="expense-optimizations"/);
  assert.match(html, /migrateLegacyRoutes\(\)/);
});
