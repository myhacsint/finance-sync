import { createHash } from "node:crypto";
import type {
  AppConfig,
  ExpenseAnalysisAdjustment,
  ExpenseClass
} from "./types.js";
import type { ActualSpendingRangeSnapshot, SpendingLine } from "./dashboard-spending.js";

const CLASS_ORDER: ExpenseClass[] = [
  "VERTRAGLICH",
  "STRUKTURELL",
  "GRUNDBEDARF",
  "DISPOSITIV",
  "UNBEKANNT"
];

const CLASS_LABELS: Record<ExpenseClass, string> = {
  VERTRAGLICH: "Vertraglich",
  STRUKTURELL: "Strukturell",
  GRUNDBEDARF: "Grundbedarf",
  DISPOSITIV: "Dispositiv",
  UNBEKANNT: "Unbekannt"
};

const DEFAULT_CLASSES: Record<string, ExpenseClass> = Object.fromEntries([
  ...["Versicherungen", "Altersvorsorge", "Abonnements", "Telefon & Internet", "Bankgebühren"]
    .map((name) => [name, "VERTRAGLICH"] as const),
  ...["Miete & Nebenkosten", "Kinder", "Auto & Kraftstoff", "Fahrrad", "ÖPNV", "Taxi & Sharing", "Steuern & Behörden"]
    .map((name) => [name, "STRUKTURELL"] as const),
  ...["Lebensmittel", "Drogerie", "Kleidung", "Energie", "Arzt & Apotheke", "Haushalt & Reparaturen", "Haustiere"]
    .map((name) => [name, "GRUNDBEDARF"] as const),
  ...["Restaurants & Cafés", "Freizeit & Hobbys", "Urlaub & Reisen", "Sport", "Geschenke & Spenden", "Homelab & IT"]
    .map((name) => [name, "DISPOSITIV"] as const),
  ...["Bargeld", "Kreditkarte historisch", "Sonstige Ausgaben", "Sonstige Einkäufe", "Ohne Kategorie"]
    .map((name) => [name, "UNBEKANNT"] as const)
]);

const NON_EXPENSE = new Set([
  "Gehalt",
  "Kapitalerträge",
  "Sonstige Einnahmen",
  "Sparen & Investieren",
  "Startsalden"
]);

export interface AnalysisSelection {
  periodYear: number;
  comparisonYear: number;
}

interface AnalysisItem {
  id: string;
  date: string;
  merchant: string;
  category: string;
  class: ExpenseClass;
  amountMinor: number;
  estimate: boolean;
  note?: string;
}

export interface AnalysisTransaction {
  key: string;
  date: string;
  merchant: string;
  amountMinor: number;
  estimate: boolean;
}

interface PeriodResult {
  year: number;
  label: string;
  startDate: string;
  endDate: string;
  totalMinor: number;
  estimate: boolean;
  items: AnalysisItem[];
}

export interface DashboardAnalyses {
  generatedAt: string;
  state: "current" | "estimated" | "partial" | "empty";
  source: "Actual + FinanceSync-Konfiguration";
  selection: AnalysisSelection & { view: "expense-structure" };
  availableYears: number[];
  period: Omit<PeriodResult, "items">;
  comparison: Omit<PeriodResult, "items">;
  changePercent: number | null;
  unknownMinor: number;
  unknownPercent: number;
  categories: Array<{
    key: string;
    label: string;
    periodMinor: number;
    comparisonMinor: number;
    periodTransactions: AnalysisTransaction[];
    comparisonTransactions: AnalysisTransaction[];
  }>;
  classes: Array<{
    key: ExpenseClass;
    label: string;
    amountMinor: number;
    percent: number;
  }>;
  positions: Array<{
    key: string;
    label: string;
    category: string;
    class: ExpenseClass;
    amountMinor: number;
    estimate: boolean;
    months: Array<{ month: string; amountMinor: number }>;
  }>;
  warnings: string[];
  basis: string[];
}

function currentParts(now: Date, timezone: string): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value)
  };
}

function endOfMonth(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function analysesSelection(
  config: AppConfig,
  now: Date,
  requestedPeriod?: number,
  requestedComparison?: number
): AnalysisSelection & { availableYears: number[]; completedMonths: number } {
  const current = currentParts(now, config.timezone);
  const oldest = Math.min(
    current.year - 1,
    Math.max(2000, config.analysis?.expenseStructure?.oldestYear ?? current.year - 2)
  );
  const availableYears = Array.from(
    { length: current.year - oldest + 1 },
    (_, index) => current.year - index
  );
  const defaultPeriod = current.year - 1;
  const periodYear = requestedPeriod && availableYears.includes(requestedPeriod)
    ? requestedPeriod
    : defaultPeriod;
  const comparisonFallback = availableYears.find((year) => year < periodYear)
    ?? availableYears.find((year) => year !== periodYear)
    ?? periodYear;
  const comparisonYear = requestedComparison
    && requestedComparison !== periodYear
    && availableYears.includes(requestedComparison)
    ? requestedComparison
    : comparisonFallback;
  return {
    periodYear,
    comparisonYear,
    availableYears,
    completedMonths: Math.max(1, current.month - 1)
  };
}

export function analysesRange(
  selection: ReturnType<typeof analysesSelection>,
  currentYear: number
): { startDate: string; endDate: string } {
  const firstYear = Math.min(selection.periodYear, selection.comparisonYear);
  const lastYear = Math.max(selection.periodYear, selection.comparisonYear);
  const lastMonth = lastYear === currentYear ? selection.completedMonths : 12;
  return { startDate: `${firstYear}-01-01`, endDate: endOfMonth(lastYear, lastMonth) };
}

function correctedLine(
  line: SpendingLine,
  config: AppConfig
): { category: string; class: ExpenseClass } {
  const merchant = line.merchant.toLocaleLowerCase("de-DE");
  let category = line.categoryLabel;
  if (/123energie|naturwerke/.test(merchant)) category = "Energie";
  if (/^awg(?:\b|\s)/i.test(line.merchant)) category = "Kleidung";
  if (/lr health.*beauty/i.test(line.merchant)) category = "Drogerie";
  const configured = config.analysis?.expenseStructure;
  let classification = configured?.categoryClasses?.[category]
    ?? DEFAULT_CLASSES[category]
    ?? "UNBEKANNT";
  for (const override of configured?.overrides ?? []) {
    const hasMatcher = override.merchantContains || override.notesContains
      || override.categoryEquals || override.dateEquals || Number.isFinite(override.amountMinor);
    if (!hasMatcher) continue;
    if (override.merchantContains
      && !merchant.includes(override.merchantContains.toLocaleLowerCase("de-DE"))) continue;
    if (override.notesContains
      && !line.notes.toLocaleLowerCase("de-DE")
        .includes(override.notesContains.toLocaleLowerCase("de-DE"))) continue;
    if (override.categoryEquals && category !== override.categoryEquals) continue;
    if (override.dateEquals && line.date !== override.dateEquals) continue;
    if (Number.isFinite(override.amountMinor) && line.amountMinor !== override.amountMinor) continue;
    if (override.category) category = override.category;
    if (override.class) classification = override.class;
  }
  classification = configured?.categoryClasses?.[category] ?? classification;
  return { category, class: classification };
}

function periodMonths(year: number, currentYear: number, completedMonths: number): number {
  return year === currentYear ? completedMonths : 12;
}

function adjustmentAmount(
  adjustment: ExpenseAnalysisAdjustment,
  months: number
): number | null {
  if (Number.isFinite(adjustment.amountMinor)) return Math.round(adjustment.amountMinor!);
  if (Number.isFinite(adjustment.annualAmountMinor)) {
    return adjustment.prorateCompletedMonths
      ? Math.round(adjustment.annualAmountMinor! * months / 12)
      : Math.round(adjustment.annualAmountMinor!);
  }
  return null;
}

function buildPeriod(
  snapshot: ActualSpendingRangeSnapshot,
  config: AppConfig,
  year: number,
  currentYear: number,
  completedMonths: number
): PeriodResult {
  const months = periodMonths(year, currentYear, completedMonths);
  const startDate = `${year}-01-01`;
  const endDate = endOfMonth(year, months);
  const items: AnalysisItem[] = snapshot.lines
    .filter((line) => line.date >= startDate && line.date <= endDate)
    .filter((line) => !NON_EXPENSE.has(line.categoryLabel))
    .map((line) => {
      const corrected = correctedLine(line, config);
      return {
        id: line.id,
        date: line.date,
        merchant: line.merchant,
        category: corrected.category,
        class: corrected.class,
        amountMinor: line.amountMinor,
        estimate: false
      };
    });
  for (const adjustment of config.analysis?.expenseStructure?.adjustments ?? []) {
    if (adjustment.year !== year) continue;
    const amountMinor = adjustmentAmount(adjustment, months);
    if (amountMinor === null || amountMinor === 0) continue;
    items.push({
      id: `adjustment:${adjustment.id}:${year}`,
      date: endDate,
      merchant: adjustment.label,
      category: adjustment.category,
      class: adjustment.class,
      amountMinor,
      estimate: Boolean(adjustment.estimate),
      note: adjustment.note
    });
  }
  return {
    year,
    label: year === currentYear ? `${year} (Jan–${String(months).padStart(2, "0")})` : String(year),
    startDate,
    endDate,
    totalMinor: items.reduce((sum, item) => sum + item.amountMinor, 0),
    estimate: items.some((item) => item.estimate),
    items
  };
}

function positionLabel(item: AnalysisItem): string {
  if (item.id.startsWith("adjustment:")) return item.merchant;
  if (item.category === "Bargeld") return "Bargeldabhebungen";
  if (item.category === "Lebensmittel" && /lidl sagt danke/i.test(item.merchant)) {
    return "Lebensmittelhandel";
  }
  if (item.category === "Versicherungen" && /alte oldenburger/i.test(item.merchant)) {
    return "Krankenversicherung";
  }
  if (item.category === "Kinder" && /^evang\./i.test(item.merchant)) {
    return "Kinderbetreuung";
  }
  if (/paypal p2p/i.test(item.merchant)) return "PayPal P2P – Privatpersonen";
  return item.merchant;
}

function publicPositionKey(label: string, category: string): string {
  return `position-${createHash("sha256")
    .update(`finance-hub:analysis:${category}:${label}`)
    .digest("hex").slice(0, 12)}`;
}

function publicTransactionKey(item: AnalysisItem): string {
  return `booking-${createHash("sha256")
    .update(`finance-hub:analysis-transaction:${item.category}:${item.id}`)
    .digest("hex").slice(0, 14)}`;
}

function publicTransactions(items: AnalysisItem[], category: string): AnalysisTransaction[] {
  return items
    .filter((item) => item.category === category)
    .map((item) => ({
      key: publicTransactionKey(item),
      date: item.date,
      merchant: positionLabel(item),
      amountMinor: item.amountMinor,
      estimate: item.estimate
    }))
    .sort((left, right) => right.amountMinor - left.amountMinor
      || right.date.localeCompare(left.date)
      || left.merchant.localeCompare(right.merchant, "de"));
}

function withoutItems(period: PeriodResult): Omit<PeriodResult, "items"> {
  const { items: _items, ...publicPeriod } = period;
  return publicPeriod;
}

export function buildDashboardAnalyses(
  snapshot: ActualSpendingRangeSnapshot,
  config: AppConfig,
  requestedPeriod?: number,
  requestedComparison?: number,
  now = new Date()
): DashboardAnalyses {
  const selection = analysesSelection(config, now, requestedPeriod, requestedComparison);
  const current = currentParts(now, config.timezone);
  const period = buildPeriod(
    snapshot,
    config,
    selection.periodYear,
    current.year,
    selection.completedMonths
  );
  const comparison = buildPeriod(
    snapshot,
    config,
    selection.comparisonYear,
    current.year,
    selection.completedMonths
  );
  const categoryRows = new Map<string, { periodMinor: number; comparisonMinor: number }>();
  for (const [kind, result] of [["period", period], ["comparison", comparison]] as const) {
    for (const item of result.items) {
      const row = categoryRows.get(item.category) ?? { periodMinor: 0, comparisonMinor: 0 };
      row[kind === "period" ? "periodMinor" : "comparisonMinor"] += item.amountMinor;
      categoryRows.set(item.category, row);
    }
  }
  const classAmounts = new Map<ExpenseClass, number>(CLASS_ORDER.map((key) => [key, 0]));
  const positionRows = new Map<string, {
    seed: string;
    label: string;
    category: string;
    class: ExpenseClass;
    amountMinor: number;
    estimate: boolean;
    months: Map<string, number>;
  }>();
  for (const item of period.items) {
    classAmounts.set(item.class, (classAmounts.get(item.class) ?? 0) + item.amountMinor);
    const label = positionLabel(item);
    const mapKey = `${item.category}\u0000${item.class}\u0000${label}`
      + (label === "Private Gegenpartei" ? `\u0000${item.id}` : "");
    const row = positionRows.get(mapKey) ?? {
      seed: mapKey,
      label,
      category: item.category,
      class: item.class,
      amountMinor: 0,
      estimate: false,
      months: new Map<string, number>()
    };
    row.amountMinor += item.amountMinor;
    row.estimate ||= item.estimate;
    const month = item.date.slice(0, 7);
    row.months.set(month, (row.months.get(month) ?? 0) + item.amountMinor);
    positionRows.set(mapKey, row);
  }
  const unknownMinor = classAmounts.get("UNBEKANNT") ?? 0;
  const warnings: string[] = [];
  if (period.items.some((item) => item.category === "Kreditkarte historisch")) {
    warnings.push("Kreditkartenumsätze sind bis einschließlich Februar 2026 nur als Sammelabbuchungen verfügbar.");
  }
  if (period.estimate || comparison.estimate) {
    warnings.push("Mindestens ein Vergleichswert enthält eine ausdrücklich markierte Schätzung.");
  }
  if (period.items.length === 0) warnings.push("Für den gewählten Zeitraum liegen keine Ausgaben vor.");
  const state = period.items.length === 0
    ? "empty"
    : period.estimate
      ? "estimated"
      : snapshot.lines.length === 0
        ? "partial"
        : "current";
  return {
    generatedAt: snapshot.generatedAt,
    state,
    source: "Actual + FinanceSync-Konfiguration",
    selection: {
      view: "expense-structure",
      periodYear: selection.periodYear,
      comparisonYear: selection.comparisonYear
    },
    availableYears: selection.availableYears,
    period: withoutItems(period),
    comparison: withoutItems(comparison),
    changePercent: comparison.totalMinor === 0
      ? null
      : Math.round((period.totalMinor - comparison.totalMinor) / comparison.totalMinor * 1000) / 10,
    unknownMinor,
    unknownPercent: period.totalMinor > 0
      ? Math.round(unknownMinor / period.totalMinor * 1000) / 10
      : 0,
    categories: [...categoryRows.entries()]
      .map(([label, amounts]) => ({
        key: `category-${createHash("sha256").update(`analysis:${label}`).digest("hex").slice(0, 10)}`,
        label,
        ...amounts,
        periodTransactions: publicTransactions(period.items, label),
        comparisonTransactions: publicTransactions(comparison.items, label)
      }))
      .sort((left, right) => right.periodMinor - left.periodMinor
        || left.label.localeCompare(right.label, "de")),
    classes: CLASS_ORDER.map((key) => ({
      key,
      label: CLASS_LABELS[key],
      amountMinor: classAmounts.get(key) ?? 0,
      percent: period.totalMinor > 0
        ? Math.round((classAmounts.get(key) ?? 0) / period.totalMinor * 1000) / 10
        : 0
    })),
    positions: [...positionRows.values()]
      .map((row) => ({
        key: publicPositionKey(row.seed, row.category),
        label: row.label,
        category: row.category,
        class: row.class,
        amountMinor: row.amountMinor,
        estimate: row.estimate,
        months: [...row.months.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([month, amountMinor]) => ({ month, amountMinor }))
      }))
      .sort((left, right) => right.amountMinor - left.amountMinor
        || left.label.localeCompare(right.label, "de")),
    warnings,
    basis: [
      "Gebuchte Ausgaben aus Actual",
      "Interne Überträge und Sparen/Investieren ausgeschlossen",
      "Erstattungen innerhalb derselben Position gegengerechnet",
      "Lokale Zusatzwerte getrennt ausgewiesen"
    ]
  };
}
