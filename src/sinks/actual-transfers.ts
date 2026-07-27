import { readSecret } from "../config.js";
import type { AppConfig } from "../types.js";
import type { InternalTransferPair } from "../reconcile.js";

interface ActualTransaction {
  id: string;
  account: string;
  amount: number;
  imported_id?: string;
  transfer_id?: string;
  notes?: string;
}

export async function linkActualTransfers(
  config: NonNullable<AppConfig["actual"]>,
  pairs: InternalTransferPair[]
): Promise<number> {
  if (!config.enabled || pairs.length === 0) return 0;
  const password = readSecret("actual-password");
  if (!password) throw new Error("Secret actual-password fehlt");
  const api = await import("@actual-app/api");
  await api.init({
    dataDir: config.dataDir,
    serverURL: config.serverUrl,
    password
  });
  try {
    await api.downloadBudget(config.budgetId);
    const mappedAccountIds = Array.from(new Set(
      pairs.flatMap((pair) => [
        config.accountMap[pair.left.accountId],
        config.accountMap[pair.right.accountId]
      ])
    ));
    if (mappedAccountIds.some((accountId) => !accountId)) {
      throw new Error("Actual-Kontozuordnung für internen Transfer fehlt");
    }
    const accountIds = mappedAccountIds as string[];
    const imported = new Map<string, ActualTransaction>();
    const before = new Map<string, { balance: number; count: number }>();
    for (const accountId of accountIds) {
      const transactions = await api.getTransactions(
        accountId,
        "1970-01-01",
        new Date().toISOString().slice(0, 10)
      );
      before.set(accountId, {
        balance: await api.getAccountBalance(accountId),
        count: transactions.length
      });
      for (const transaction of transactions) {
        if (transaction.imported_id) {
          imported.set(transaction.imported_id, transaction as ActualTransaction);
        }
      }
    }
    const payees = await api.getPayees();
    let changed = 0;
    const expected = new Map<string, string>();
    for (const pair of pairs) {
      const actualLeft = imported.get(
        `${pair.left.sourceId}:${pair.left.sourceTransactionId}`
      );
      const actualRight = imported.get(
        `${pair.right.sourceId}:${pair.right.sourceTransactionId}`
      );
      if (!actualLeft || !actualRight) {
        throw new Error("Actual-Buchung für internen Transfer fehlt");
      }
      const leftAccountId = config.accountMap[pair.left.accountId];
      const rightAccountId = config.accountMap[pair.right.accountId];
      if (
        actualLeft.account !== leftAccountId
        || actualRight.account !== rightAccountId
        || actualLeft.amount !== -actualRight.amount
      ) {
        throw new Error("Actual-Transferkandidat stimmt nicht mit dem Archiv überein");
      }
      expected.set(actualLeft.id, actualRight.id);
      expected.set(actualRight.id, actualLeft.id);
      if (
        actualLeft.transfer_id === actualRight.id
        && actualRight.transfer_id === actualLeft.id
      ) {
        continue;
      }
      const payeeToRight = payees.find(
        (payee) => payee.transfer_acct === rightAccountId
      );
      const payeeToLeft = payees.find(
        (payee) => payee.transfer_acct === leftAccountId
      );
      if (!payeeToRight || !payeeToLeft) {
        throw new Error("Actual-Transfer-Payee fehlt");
      }
      const notes = Array.from(new Set(
        [actualLeft.notes, actualRight.notes].filter(Boolean)
      )).join(" | ");
      await api.updateTransaction(actualLeft.id, {
        payee: payeeToRight.id,
        transfer_id: actualRight.id,
        category: null as unknown as string,
        notes: notes || undefined
      });
      await api.updateTransaction(actualRight.id, {
        payee: payeeToLeft.id,
        transfer_id: actualLeft.id,
        category: null as unknown as string,
        notes: notes || undefined
      });
      changed += 1;
    }
    if (changed > 0) await api.sync();

    const verified = new Map<string, ActualTransaction>();
    for (const accountId of accountIds) {
      const transactions = await api.getTransactions(
        accountId,
        "1970-01-01",
        new Date().toISOString().slice(0, 10)
      );
      const prior = before.get(accountId)!;
      if (
        transactions.length !== prior.count
        || await api.getAccountBalance(accountId) !== prior.balance
      ) {
        throw new Error("Actual-Transferverknüpfung hat Saldo oder Buchungszahl verändert");
      }
      for (const transaction of transactions) {
        verified.set(transaction.id, transaction as ActualTransaction);
      }
    }
    for (const [id, transferId] of expected) {
      if (verified.get(id)?.transfer_id !== transferId) {
        throw new Error("Actual-Transferverknüpfung ist nicht beidseitig");
      }
    }
    return pairs.length;
  } finally {
    await api.shutdown();
  }
}
