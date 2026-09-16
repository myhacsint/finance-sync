import type { FinanceDatabase } from './database.js';

interface Movement { id: number; account_id: string; occurred_at: string; type: string; symbol: string; quantity_atomic: string; atomic_decimals: number; amount_minor: number | null; currency: string | null }
interface Cash { id: number; account_id: string; booked_at: string; amount_minor: number; currency: string; memo: string | null; payee: string | null }

/** Evidence report only. No invented balancing transactions or inferred fees. */
export function depotSettlementReport(db: FinanceDatabase) {
  const movements = db.query("SELECT id, account_id, occurred_at, type, symbol, quantity_atomic, atomic_decimals, amount_minor, currency FROM investment_activities WHERE type IN ('DEPOT_RECE', 'DEPOT_DELI') ORDER BY occurred_at DESC, id DESC") as unknown as Movement[];
  const cash = db.query("SELECT id, account_id, booked_at, amount_minor, currency, memo, payee FROM transactions WHERE internal_transfer_id IS NULL") as unknown as Cash[];
  const edges = movements.map(m => {
    const candidates = cash.filter(c => {
      if (m.amount_minor === null || m.currency !== c.currency) return false;
      if ((m.type === 'DEPOT_RECE') !== (c.amount_minor < 0)) return false;
      const days = (Date.parse(c.booked_at) - Date.parse(m.occurred_at)) / 86400000;
      if (!Number.isFinite(days) || days < 0 || days > 7) return false;
      const text = `${c.payee ?? ''} ${c.memo ?? ''}`;
      if (!/\bDKB\b|wertp\.?\s*abrechn|wertpapier/i.test(text)) return false;
      return Math.abs(Math.abs(c.amount_minor) - Math.abs(m.amount_minor)) <= 2500;
    });
    return {m, candidates};
  });
  const degree = new Map<number, number>();
  for (const e of edges) for (const c of e.candidates) degree.set(c.id, (degree.get(c.id) ?? 0) + 1);
  return edges.map(({m, candidates}) => {
    const c = candidates.length === 1 && degree.get(candidates[0].id) === 1 ? candidates[0] : undefined;
    const differenceMinor = c && m.amount_minor !== null ? Math.abs(c.amount_minor) - Math.abs(m.amount_minor) : null;
    const isinConfirmed = Boolean(c?.memo?.includes(m.symbol));
    const quantity = Number(m.quantity_atomic) / 10 ** m.atomic_decimals;
    const quantityConfirmed = Boolean(c?.memo && [...c.memo.matchAll(/(?:Stück|Stueck)\s*([0-9]+(?:[,.][0-9]+)?)/gi)].some(match => Number(match[1].replace(',', '.')) === quantity));
    return {
      activityId: m.id, date: m.occurred_at, symbol: m.symbol,
      direction: m.type === 'DEPOT_RECE' ? 'ZUGANG' : 'ABGANG',
      amountMinor: m.amount_minor, currency: m.currency,
      status: !c ? (candidates.length ? 'AMBIGUOUS' : 'UNMATCHED')
        : differenceMinor === 0 && isinConfirmed && quantityConfirmed ? 'EVIDENCE_MATCH' : 'REVIEW_REQUIRED',
      candidateCount: candidates.length, bankTransactionId: c?.id ?? null,
      differenceMinor, isinConfirmed, quantityConfirmed, feeMinor: null,
      reason: !c ? 'Keine eindeutige Girozuordnung' : differenceMinor !== 0
        ? 'Betragsdifferenz ungeklärt; keine Gebühr abgeleitet'
        : !isinConfirmed || !quantityConfirmed ? 'Wertpapier oder Stückzahl nicht vollständig belegt'
        : 'Betrag, Wertpapier und Stückzahl stimmen überein; keine automatische Buchungsänderung'
    };
  });
}
