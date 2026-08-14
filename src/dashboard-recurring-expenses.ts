import { createHash } from "node:crypto";
import type { ActualSpendingRangeSnapshot, SpendingLine } from "./dashboard-spending.js";
import type {
  RecurringExpenseDecision,
  RecurringExpenseDecisionRecord
} from "./types.js";

export type RecurringRhythm = "monatlich" | "vierteljaehrlich" | "jaehrlich";
export type RecurringConfidence = "hoch" | "mittel";
export type RecurringReviewStatus = "moeglich" | "bestaetigt" | "kein-kandidat";

export interface RecurringExpenseQuery {
  rhythm?: "alle" | RecurringRhythm;
  review?: "alle" | RecurringReviewStatus;
  classification?: "alle" | Exclude<RecurringExpenseDecision, "KEIN_KANDIDAT">;
  confidence?: "alle" | RecurringConfidence;
}

interface AggregatedPayment {
  date: string;
  amountMinor: number;
  lineIds: string[];
  category: string;
}

interface RhythmMatch {
  kind: RecurringRhythm;
  confidence: RecurringConfidence;
  typicalDays: number;
  typicalMinor: number;
  minMinor: number;
  maxMinor: number;
  outlierDates: Set<string>;
  payments: AggregatedPayment[];
}

export interface DetectedRecurringCandidate {
  key: string;
  label: string;
  merchantKey: string;
  categoryKey: string;
  category: string;
  evidenceHash: string;
  rhythm: RhythmMatch;
  refunds: SpendingLine[];
  groupLines: SpendingLine[];
}

export interface DashboardRecurringCandidate {
  key: string;
  label: string;
  reviewStatus: RecurringReviewStatus;
  statusLabel: string;
  classification: {
    value: Exclude<RecurringExpenseDecision, "KEIN_KANDIDAT">;
    label: string;
    confidence: "unbestaetigt" | "nutzerbestaetigt";
  };
  decision: {
    value: RecurringExpenseDecision;
    updatedAt: string;
    stale: boolean;
  } | null;
  rhythm: {
    kind: RecurringRhythm;
    label: string;
    confidence: RecurringConfidence;
    typicalDays: number;
  };
  amount: {
    currency: "EUR";
    typicalMinor: number;
    lastMinor: number;
    minMinor: number;
    maxMinor: number;
  };
  observation: {
    startDate: string;
    endDate: string;
    lastPaymentDate: string;
    occurrences: number;
    exceptions: number;
  };
  evidence: {
    status: "booking-only";
    label: "Nur Buchungsdaten";
    source: "Actual";
    evidenceHash: string;
  };
  markingReasons: string[];
  decisionLabEligible: boolean;
}

export interface DashboardRecurringExpenses {
  generatedAt: string;
  state: "current" | "partial" | "stale" | "empty";
  source: "Actual";
  freshness: {
    lastSuccessfulAt: string;
    windowStart: string;
    windowEnd: string;
    lastCompleteMonth: string;
  };
  selection: Required<RecurringExpenseQuery>;
  summary: {
    possible: number;
    confirmed: number;
    notCandidate: number;
    visible: number;
  };
  candidates: DashboardRecurringCandidate[];
  warnings: string[];
  basis: string[];
}

export interface DashboardRecurringExpenseDetail {
  generatedAt: string;
  state: DashboardRecurringExpenses["state"];
  source: "Actual";
  candidate: DashboardRecurringCandidate;
  payments: Array<{
    key: string;
    date: string;
    amountMinor: number;
    category: string;
    kind: "payment" | "refund" | "exception";
  }>;
  warnings: string[];
  basis: string[];
}

const DECISION_LABELS: Record<Exclude<RecurringExpenseDecision, "KEIN_KANDIDAT">, string> = {
  GRUNDBEDARF: "Grundbedarf",
  GESTALTBAR: "Gestaltbar",
  VERMEIDBAR: "Vermeidbar",
  UNKLAR: "Unklar"
};

const RHYTHM_LABELS: Record<RecurringRhythm, string> = {
  monatlich: "Monatlich",
  vierteljaehrlich: "Vierteljährlich",
  jaehrlich: "Jährlich"
};

const FINGERPRINT_VERSION = 1;

function hash(prefix: string, value: string, length = 16): string {
  return `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, length)}`;
}

function utcDay(value: string): number {
  return Math.floor(Date.parse(`${value}T00:00:00Z`) / 86_400_000);
}

function dayGap(left: string, right: string): number {
  return utcDay(right) - utcDay(left);
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function shiftMonth(key: string, offset: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthEnd(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${key}-${String(day).padStart(2, "0")}`;
}

function currentMonth(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export function recurringExpenseRange(
  now: Date,
  timezone: string
): { startDate: string; endDate: string; lastCompleteMonth: string } {
  const lastCompleteMonth = shiftMonth(currentMonth(now, timezone), -1);
  return {
    startDate: `${shiftMonth(lastCompleteMonth, -29)}-01`,
    endDate: monthEnd(lastCompleteMonth),
    lastCompleteMonth
  };
}

function hardExclusion(line: SpendingLine): string | null {
  if (line.categoryLabel === "Kreditkarte historisch") return "historical-card-aggregate";
  if (!line.categorized || [
    "Ohne Kategorie", "Sonstige Ausgaben", "Sonstige Einkäufe", "Bargeld"
  ].includes(line.categoryLabel)) return "uncertain-assignment";
  if (line.merchant === "Private Gegenpartei"
    || /paypal p2p.*privat/i.test(line.merchant)
    || line.merchant === "Unbekannter Händler") return "private-or-unusable";
  if (/(?:^|\b)(?:amazon|ebay|etsy|marketplace)(?:\b|$)/i.test(line.merchant)) {
    return "marketplace-without-item-evidence";
  }
  return null;
}

function aggregatePositivePayments(lines: SpendingLine[]): AggregatedPayment[] {
  const byDate = new Map<string, AggregatedPayment>();
  for (const line of lines) {
    if (line.amountMinor <= 0) continue;
    const row = byDate.get(line.date) ?? {
      date: line.date,
      amountMinor: 0,
      lineIds: [],
      category: line.categoryLabel
    };
    row.amountMinor += line.amountMinor;
    row.lineIds.push(line.id);
    byDate.set(line.date, row);
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function amountProfile(
  payments: AggregatedPayment[],
  relativeTolerance: number,
  absoluteTolerance: number
): Pick<RhythmMatch, "typicalMinor" | "minMinor" | "maxMinor" | "outlierDates"> | null {
  if (payments.length === 0) return null;
  const values = payments.map((payment) => payment.amountMinor);
  const typicalMinor = median(values);
  const tolerance = Math.max(absoluteTolerance, Math.round(typicalMinor * relativeTolerance));
  const outliers = payments.filter((payment) =>
    Math.abs(payment.amountMinor - typicalMinor) > tolerance
  );
  if ((payments.length - outliers.length) / payments.length < 0.8) return null;
  return {
    typicalMinor,
    minMinor: Math.min(...values),
    maxMinor: Math.max(...values),
    outlierDates: new Set(outliers.map((payment) => payment.date))
  };
}

function matchRhythm(
  allPayments: AggregatedPayment[],
  endDate: string,
  definition: {
    kind: RecurringRhythm;
    months: number;
    minimum: number;
    gapMin: number;
    gapMax: number;
    activeDays: number;
    relativeTolerance: number;
    absoluteTolerance: number;
    highCount: number;
  }
): RhythmMatch | null {
  const endMonth = endDate.slice(0, 7);
  const startDate = `${shiftMonth(endMonth, -(definition.months - 1))}-01`;
  const payments = allPayments.filter((payment) =>
    payment.date >= startDate && payment.date <= endDate
  );
  if (payments.length < definition.minimum) return null;
  if (dayGap(payments.at(-1)!.date, endDate) > definition.activeDays) return null;
  const gaps = payments.slice(1).map((payment, index) =>
    dayGap(payments[index].date, payment.date)
  );
  if (gaps.length === 0) return null;
  const matchingGaps = gaps.filter((gap) =>
    gap >= definition.gapMin && gap <= definition.gapMax
  ).length;
  const gapRatio = matchingGaps / gaps.length;
  if (gapRatio < 0.8) return null;
  const amounts = amountProfile(
    payments,
    definition.relativeTolerance,
    definition.absoluteTolerance
  );
  if (!amounts) return null;
  return {
    kind: definition.kind,
    confidence: payments.length >= definition.highCount && gapRatio >= 0.9 ? "hoch" : "mittel",
    typicalDays: median(gaps),
    payments,
    ...amounts
  };
}

function detectedRhythm(payments: AggregatedPayment[], endDate: string): RhythmMatch | null {
  return matchRhythm(payments, endDate, {
    kind: "monatlich",
    months: 12,
    minimum: 6,
    gapMin: 20,
    gapMax: 40,
    activeDays: 62,
    relativeTolerance: 0.10,
    absoluteTolerance: 500,
    highCount: 9
  }) ?? matchRhythm(payments, endDate, {
    kind: "vierteljaehrlich",
    months: 18,
    minimum: 3,
    gapMin: 60,
    gapMax: 120,
    activeDays: 140,
    relativeTolerance: 0.15,
    absoluteTolerance: 1_000,
    highCount: 5
  }) ?? matchRhythm(payments, endDate, {
    kind: "jaehrlich",
    months: 30,
    minimum: 2,
    gapMin: 300,
    gapMax: 430,
    activeDays: 400,
    relativeTolerance: 0.15,
    absoluteTolerance: 1_000,
    highCount: 3
  });
}

export function detectRecurringCandidates(
  snapshot: ActualSpendingRangeSnapshot
): { candidates: DetectedRecurringCandidate[]; excluded: Record<string, number> } {
  const groups = new Map<string, SpendingLine[]>();
  const excludedGroups = new Map<string, string>();
  for (const line of snapshot.lines) {
    const groupKey = `${line.merchantKey}:${line.categoryKey}`;
    const reason = hardExclusion(line);
    if (reason) {
      excludedGroups.set(groupKey, reason);
      continue;
    }
    const rows = groups.get(groupKey) ?? [];
    rows.push(line);
    groups.set(groupKey, rows);
  }
  const excluded: Record<string, number> = {};
  for (const reason of excludedGroups.values()) excluded[reason] = (excluded[reason] ?? 0) + 1;
  const candidates: DetectedRecurringCandidate[] = [];
  for (const [groupKey, lines] of groups) {
    const payments = aggregatePositivePayments(lines);
    const rhythm = detectedRhythm(payments, snapshot.endDate);
    if (!rhythm) continue;
    const first = lines[0];
    const key = hash("recurring", `v${FINGERPRINT_VERSION}:${groupKey}`, 18);
    const amountBand = Math.round(rhythm.typicalMinor / 1_000) * 1_000;
    const evidenceHash = hash(
      "evidence",
      `v${FINGERPRINT_VERSION}:${groupKey}:${rhythm.kind}:${amountBand}`,
      20
    );
    const evaluationStart = rhythm.payments[0].date;
    candidates.push({
      key,
      label: first.merchant,
      merchantKey: first.merchantKey,
      categoryKey: first.categoryKey,
      category: first.categoryLabel,
      evidenceHash,
      rhythm,
      refunds: lines.filter((line) =>
        line.amountMinor < 0 && line.date >= evaluationStart && line.date <= snapshot.endDate
      ),
      groupLines: lines.filter((line) =>
        line.date >= evaluationStart && line.date <= snapshot.endDate
      )
    });
  }
  return {
    candidates: candidates.sort((left, right) =>
      right.rhythm.payments.at(-1)!.date.localeCompare(left.rhythm.payments.at(-1)!.date)
        || left.label.localeCompare(right.label, "de")
    ),
    excluded
  };
}

function normalizeQuery(query: RecurringExpenseQuery): Required<RecurringExpenseQuery> {
  const rhythms = new Set(["alle", "monatlich", "vierteljaehrlich", "jaehrlich"]);
  const reviews = new Set(["alle", "moeglich", "bestaetigt", "kein-kandidat"]);
  const classifications = new Set(["alle", "GRUNDBEDARF", "GESTALTBAR", "VERMEIDBAR", "UNKLAR"]);
  const confidences = new Set(["alle", "hoch", "mittel"]);
  return {
    rhythm: rhythms.has(String(query.rhythm)) ? query.rhythm! : "alle",
    review: reviews.has(String(query.review)) ? query.review! : "moeglich",
    classification: classifications.has(String(query.classification))
      ? query.classification!
      : "alle",
    confidence: confidences.has(String(query.confidence)) ? query.confidence! : "alle"
  };
}

function mergeDecision(
  candidate: DetectedRecurringCandidate,
  decision: RecurringExpenseDecisionRecord | undefined
): DashboardRecurringCandidate {
  const stale = Boolean(decision && (
    decision.fingerprintVersion !== FINGERPRINT_VERSION
    || decision.evidenceHash !== candidate.evidenceHash
  ));
  const effective = decision && !stale ? decision.decision : null;
  const reviewStatus: RecurringReviewStatus = effective === "KEIN_KANDIDAT"
    ? "kein-kandidat"
    : effective
      ? "bestaetigt"
      : "moeglich";
  const classification = effective && effective !== "KEIN_KANDIDAT" ? effective : "UNKLAR";
  const last = candidate.rhythm.payments.at(-1)!;
  const exceptions = candidate.rhythm.outlierDates.size + candidate.refunds.length;
  return {
    key: candidate.key,
    label: candidate.label,
    reviewStatus,
    statusLabel: reviewStatus === "moeglich"
      ? "Mögliche regelmäßige Zahlung"
      : reviewStatus === "bestaetigt"
        ? "Vom Nutzer bestätigt"
        : "Kein Kandidat",
    classification: {
      value: classification,
      label: DECISION_LABELS[classification],
      confidence: effective && effective !== "KEIN_KANDIDAT"
        ? "nutzerbestaetigt"
        : "unbestaetigt"
    },
    decision: decision ? {
      value: decision.decision,
      updatedAt: decision.updatedAt,
      stale
    } : null,
    rhythm: {
      kind: candidate.rhythm.kind,
      label: RHYTHM_LABELS[candidate.rhythm.kind],
      confidence: candidate.rhythm.confidence,
      typicalDays: candidate.rhythm.typicalDays
    },
    amount: {
      currency: "EUR",
      typicalMinor: candidate.rhythm.typicalMinor,
      lastMinor: last.amountMinor,
      minMinor: candidate.rhythm.minMinor,
      maxMinor: candidate.rhythm.maxMinor
    },
    observation: {
      startDate: candidate.rhythm.payments[0].date,
      endDate: last.date,
      lastPaymentDate: last.date,
      occurrences: candidate.rhythm.payments.length,
      exceptions
    },
    evidence: {
      status: "booking-only",
      label: "Nur Buchungsdaten",
      source: "Actual",
      evidenceHash: candidate.evidenceHash
    },
    markingReasons: [
      `${candidate.rhythm.payments.length} passende Zahlungen im Beobachtungsfenster`,
      `Typischer Abstand ${candidate.rhythm.typicalDays} Tage`,
      exceptions ? `${exceptions} Abweichungen oder Erstattungen` : "Beträge innerhalb der Toleranz"
    ],
    decisionLabEligible: effective === "GESTALTBAR" || effective === "VERMEIDBAR"
  };
}

function warningsFor(
  excluded: Record<string, number>,
  decisions: DashboardRecurringCandidate[],
  stale: boolean
): string[] {
  const warnings: string[] = [];
  if (excluded["historical-card-aggregate"]) {
    warnings.push("Historische Kreditkarten-Sammelposten wurden vollständig ausgeschlossen.");
  }
  if (excluded["marketplace-without-item-evidence"]) {
    warnings.push("Marktplätze ohne Einzelbeleg wurden vollständig ausgeschlossen.");
  }
  if (excluded["uncertain-assignment"] || excluded["private-or-unusable"]) {
    warnings.push("Nicht auswertbare oder unsicher zugeordnete Zahlungen wurden ausgeschlossen.");
  }
  if (decisions.some((candidate) => candidate.decision?.stale)) {
    warnings.push("Mindestens eine frühere Entscheidung muss wegen geänderter Beleglage erneut bestätigt werden.");
  }
  if (stale) warnings.push("Actual war nicht erreichbar. Angezeigt wird der letzte erfolgreiche Stand.");
  return warnings;
}

export function buildDashboardRecurringExpenses(
  snapshot: ActualSpendingRangeSnapshot,
  decisionRows: RecurringExpenseDecisionRecord[],
  query: RecurringExpenseQuery = {},
  options: { stale?: boolean } = {}
): DashboardRecurringExpenses {
  const selection = normalizeQuery(query);
  const detected = detectRecurringCandidates(snapshot);
  const decisionMap = new Map(decisionRows.map((row) => [row.candidateKey, row]));
  const merged = detected.candidates.map((candidate) =>
    mergeDecision(candidate, decisionMap.get(candidate.key))
  );
  const filtered = merged.filter((candidate) =>
    (selection.rhythm === "alle" || candidate.rhythm.kind === selection.rhythm)
    && (selection.review === "alle" || candidate.reviewStatus === selection.review)
    && (selection.classification === "alle"
      || candidate.classification.value === selection.classification)
    && (selection.confidence === "alle"
      || candidate.rhythm.confidence === selection.confidence)
  );
  const partial = Boolean(detected.excluded["historical-card-aggregate"]);
  const state = options.stale
    ? "stale"
    : partial
      ? "partial"
      : detected.candidates.length === 0
        ? "empty"
        : "current";
  return {
    generatedAt: snapshot.generatedAt,
    state,
    source: "Actual",
    freshness: {
      lastSuccessfulAt: snapshot.generatedAt,
      windowStart: snapshot.startDate,
      windowEnd: snapshot.endDate,
      lastCompleteMonth: snapshot.endDate.slice(0, 7)
    },
    selection,
    summary: {
      possible: merged.filter((candidate) => candidate.reviewStatus === "moeglich").length,
      confirmed: merged.filter((candidate) => candidate.reviewStatus === "bestaetigt").length,
      notCandidate: merged.filter((candidate) => candidate.reviewStatus === "kein-kandidat").length,
      visible: filtered.length
    },
    candidates: filtered,
    warnings: warningsFor(detected.excluded, merged, Boolean(options.stale)),
    basis: [
      "Einzelne gebuchte Zahlungen aus Actual",
      "Nur stabile und bis zum letzten vollständigen Monat aktuelle Rhythmen",
      "Interne Überträge, Sammelposten, Marktplätze ohne Einzelbeleg und unsichere Zuordnungen ausgeschlossen",
      "Automatische Treffer bleiben bis zur Nutzerentscheidung mögliche regelmäßige Zahlungen"
    ]
  };
}

export function buildDashboardRecurringExpenseDetail(
  snapshot: ActualSpendingRangeSnapshot,
  decisionRows: RecurringExpenseDecisionRecord[],
  candidateKey: string,
  options: { stale?: boolean } = {}
): DashboardRecurringExpenseDetail | null {
  const detected = detectRecurringCandidates(snapshot);
  const candidate = detected.candidates.find((row) => row.key === candidateKey);
  if (!candidate) return null;
  const decision = decisionRows.find((row) => row.candidateKey === candidate.key);
  const publicCandidate = mergeDecision(candidate, decision);
  const paymentDates = new Set(candidate.rhythm.payments.map((payment) => payment.date));
  const payments = candidate.groupLines.map((line) => ({
    key: hash("booking", `recurring:${line.id}`, 18),
    date: line.date,
    amountMinor: line.amountMinor,
    category: line.categoryLabel,
    kind: line.amountMinor < 0
      ? "refund" as const
      : candidate.rhythm.outlierDates.has(line.date) || !paymentDates.has(line.date)
        ? "exception" as const
        : "payment" as const
  })).sort((left, right) => right.date.localeCompare(left.date) || right.key.localeCompare(left.key));
  const overview = buildDashboardRecurringExpenses(snapshot, decisionRows, { review: "alle" }, options);
  return {
    generatedAt: overview.generatedAt,
    state: overview.state,
    source: "Actual",
    candidate: publicCandidate,
    payments,
    warnings: overview.warnings,
    basis: overview.basis
  };
}

export function recurringFingerprintVersion(): number {
  return FINGERPRINT_VERSION;
}
