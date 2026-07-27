import { createHash } from "node:crypto";
import type { FinanceDatabase } from "./database.js";

export interface InternalTransferCandidate {
  id: number;
  sourceId: string;
  sourceTransactionId: string;
  accountId: string;
  bookedAt: string;
  amountMinor: number;
  currency: string;
  payee?: string;
  memo?: string;
}

export interface InternalTransferPair {
  left: InternalTransferCandidate;
  right: InternalTransferCandidate;
  transferId: string;
}

interface CandidateRow {
  id: number;
  source_id: string;
  source_transaction_id?: string;
  account_id: string;
  booked_at: string;
  amount_minor: number;
  currency: string;
  payee?: string;
  memo?: string;
}

function ownerPattern(owners: string[]): RegExp | undefined {
  const names = Array.from(new Set(owners))
    .map((owner) => owner.trim())
    .filter((owner) => owner.length >= 3)
    .map((owner) => owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return names.length ? new RegExp(`\\b(?:${names.join("|")})\\b`, "i") : undefined;
}

export function findInternalTransferPairs(
  db: FinanceDatabase,
  owners: string[]
): InternalTransferPair[] {
  const rows = db.query(`
    SELECT id, source_id, source_transaction_id, account_id, booked_at,
           amount_minor, currency, payee, memo
    FROM transactions
    WHERE internal_transfer_id IS NULL
    ORDER BY booked_at, id
  `) as unknown as CandidateRow[];
  const edges: Array<{ left: CandidateRow; right: CandidateRow }> = [];
  const degree = new Map<number, number>();
  const rowsByAmount = new Map<number, CandidateRow[]>();
  for (const row of rows) {
    const matches = rowsByAmount.get(row.amount_minor) ?? [];
    matches.push(row);
    rowsByAmount.set(row.amount_minor, matches);
  }
  for (const left of rows) {
    if (left.amount_minor === 0) continue;
    for (const right of rowsByAmount.get(-left.amount_minor) ?? []) {
      if (right.id <= left.id) continue;
      if (left.account_id === right.account_id) continue;
      if (left.currency !== right.currency) continue;
      const days = Math.abs(
        new Date(left.booked_at).getTime() - new Date(right.booked_at).getTime()
      ) / 86_400_000;
      if (days > 3) continue;
      edges.push({ left, right });
      degree.set(left.id, (degree.get(left.id) ?? 0) + 1);
      degree.set(right.id, (degree.get(right.id) ?? 0) + 1);
    }
  }

  const names = ownerPattern(owners);
  const transferWord =
    /(?:^|[^\p{L}\p{N}])(?:umbuchung|eigenübertrag|übertrag|transfer)(?=$|[^\p{L}\p{N}])/iu;
  return edges.flatMap(({ left, right }) => {
    if (degree.get(left.id) !== 1 || degree.get(right.id) !== 1) return [];
    if (!left.source_transaction_id || !right.source_transaction_id) return [];
    const text = [left.payee, left.memo, right.payee, right.memo]
      .filter(Boolean)
      .join(" ");
    if (!names?.test(text) && !transferWord.test(text)) return [];
    const transferId = createHash("sha256")
      .update([left.id, right.id].sort((a, b) => a - b).join(":"))
      .digest("hex")
      .slice(0, 24);
    const normalize = (row: CandidateRow): InternalTransferCandidate => ({
      id: row.id,
      sourceId: row.source_id,
      sourceTransactionId: row.source_transaction_id!,
      accountId: row.account_id,
      bookedAt: row.booked_at,
      amountMinor: row.amount_minor,
      currency: row.currency,
      payee: row.payee,
      memo: row.memo
    });
    return [{
      left: normalize(left),
      right: normalize(right),
      transferId
    }];
  });
}

export function markInternalTransfers(
  db: FinanceDatabase,
  pairs: InternalTransferPair[]
): number {
  if (pairs.length === 0) return 0;
  const update = db.db.prepare(
    "UPDATE transactions SET internal_transfer_id=? WHERE id IN (?, ?)"
  );
  db.db.exec("BEGIN IMMEDIATE");
  try {
    for (const pair of pairs) {
      update.run(pair.transferId, pair.left.id, pair.right.id);
    }
    db.db.exec("COMMIT");
    return pairs.length;
  } catch (error) {
    db.db.exec("ROLLBACK");
    throw error;
  }
}
