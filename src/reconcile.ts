import { createHash } from "node:crypto";
import type { FinanceDatabase } from "./database.js";

interface Candidate {
  id: number;
  account_id: string;
  booked_at: string;
  amount_minor: number;
}

export function markInternalTransfers(db: FinanceDatabase): number {
  const rows = db.query(`
    SELECT id, account_id, booked_at, amount_minor
    FROM transactions
    WHERE internal_transfer_id IS NULL
    ORDER BY booked_at, id
  `) as unknown as Candidate[];
  let matched = 0;
  const used = new Set<number>();
  const update = db.db.prepare(
    "UPDATE transactions SET internal_transfer_id=? WHERE id IN (?, ?)"
  );
  for (let i = 0; i < rows.length; i += 1) {
    const left = rows[i];
    if (used.has(left.id)) continue;
    for (let j = i + 1; j < rows.length; j += 1) {
      const right = rows[j];
      if (used.has(right.id) || left.account_id === right.account_id) continue;
      if (left.amount_minor !== -right.amount_minor) continue;
      const days = Math.abs(
        new Date(left.booked_at).getTime() - new Date(right.booked_at).getTime()
      ) / 86_400_000;
      if (days > 3) continue;
      const transferId = createHash("sha256")
        .update([left.id, right.id].sort((a, b) => a - b).join(":"))
        .digest("hex")
        .slice(0, 24);
      update.run(transferId, left.id, right.id);
      used.add(left.id);
      used.add(right.id);
      matched += 1;
      break;
    }
  }
  return matched;
}
