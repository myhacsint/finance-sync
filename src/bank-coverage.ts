import { result, type CheckResult } from "./dashboard-month-check.js";

export interface BankRequestEvidence {
  version: 1;
  strategy: string;
  requestedFrom: string | null;
  requestedTo: string | null;
  startedAt: string;
  completedAt: string;
  pages: number;
  paginationComplete: boolean;
  observedFrom: string | null;
  observedTo: string | null;
  transactions: number;
}

// Requested range, observed range and bank retention are deliberately distinct.
// A successful longest/default request does not establish an explicit lower bound.
export function checkBankCoverage(raws: unknown[], accountId: string, start: string, end: string): CheckResult {
  const intervals: Array<{from:string;to:string}> = [];
  let seen = false, incomplete = false;
  for (const raw of raws) {
    const rows = (raw as {requestEvidence?: Record<string, BankRequestEvidence[]>} | null)?.requestEvidence?.[accountId];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row.version !== 1) continue;
      seen = true;
      if (!row.paginationComplete) { incomplete = true; continue; }
      if (row.strategy === "longest" || !row.requestedFrom || !row.requestedTo) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.requestedFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(row.requestedTo)
        || row.requestedFrom > row.requestedTo || !Number.isFinite(Date.parse(row.completedAt))
        || row.completedAt.slice(0,10) <= end) continue;
      intervals.push({from:row.requestedFrom,to:row.requestedTo});
    }
  }
  let covered = start;
  for (const range of intervals.sort((a,b)=>a.from.localeCompare(b.from))) {
    if (range.from > covered) break;
    if (range.to >= covered) covered = new Date(Date.parse(`${range.to}T00:00:00Z`)+86400000).toISOString().slice(0,10);
  }
  if (covered > end) return result("ok","Abruf belegt","REQUEST_RANGE_COMPLETE","Der ganze Monat wurde nach Monatsende ausdrücklich angefragt und alle Antwortseiten wurden gelesen. Bankseitige Rückschaugrenzen und nachträgliche Korrekturen bleiben möglich; kein Ersatz für einen Kontoauszug.");
  return incomplete ? result("open","Unvollständig","PAGINATION_INCOMPLETE","Ein Abruf enthält nicht alle Antwortseiten. Der Abruf muss geklärt werden.")
    : seen ? result("unknown","Zeitraum offen","REQUEST_RANGE_UNBOUNDED","Abruf und Pagination sind dokumentiert, aber der ganze Kalendermonat ist nicht durch einen expliziten Zeitraum nach Monatsende belegt. Erste und letzte Buchung beweisen keine Vollständigkeit.")
      : result("unknown","Unklar","REQUEST_COVERAGE_UNRECORDED","Historische Antworten enthalten keinen vollständigen Nachweis von Anfragezeitraum und Pagination. Ein erfolgreicher Abruf ist kein Vollständigkeitsnachweis.");
}
