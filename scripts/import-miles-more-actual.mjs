import * as actual from "@actual-app/api";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const apply = process.argv.includes("--apply");
const inputPath = process.argv.find((value) => value.endsWith(".json"));
if (!inputPath) throw new Error("Import-JSON fehlt");
const payload = JSON.parse(readFileSync(inputPath, "utf8"));
const config = JSON.parse(readFileSync("/app/data/config.json", "utf8")).actual;
const password = readFileSync("/run/secrets/actual-password", "utf8").trim();
const dataDir = mkdtempSync(join(tmpdir(), "actual-miles-more-"));

function one(items, label) {
  if (items.length !== 1) throw new Error(`${label}: ${items.length} statt 1 Treffer`);
  return items[0];
}

try {
  await actual.init({ dataDir, serverURL: config.serverUrl, password });
  await actual.downloadBudget(config.budgetId);
  const accounts = await actual.getAccounts();
  const card = one(accounts.filter((item) => /Kreditkarte/i.test(item.name)), "Kartenkonto");
  const source = one(
    accounts.filter((item) => item.name === payload.settlement.sourceAccountName),
    "Ausgleichskonto"
  );
  const categories = (await actual.getCategories()).flatMap((item) => item.categories ?? [item]);
  const categoryIds = new Map(categories.map((item) => [item.name, item.id]));
  const categoryMissing = payload.transactions
    .map((item) => item.categoryName)
    .filter(Boolean)
    .filter((name) => !categoryIds.has(name));
  if (categoryMissing.length) throw new Error(`Kategorien fehlen: ${categoryMissing.join(", ")}`);

  const cardRows = payload.transactions.map((item) => ({
    account: card.id,
    date: item.purchaseDate,
    amount: item.amountMinor,
    payee_name: item.payee,
    imported_payee: item.rawPayee,
    category: item.categoryName ? categoryIds.get(item.categoryName) : undefined,
    notes: item.notes,
    imported_id: item.importedId,
    cleared: true
  }));
  const paymentImportedId = `miles-more-payment:${payload.settlement.date}:${payload.settlement.amountMinor}`;
  const paymentRow = {
    account: card.id,
    date: payload.settlement.date,
    amount: payload.settlement.amountMinor,
    payee_name: source.name,
    notes: `Kreditkartenabrechnung ${payload.statementDate}`,
    imported_id: paymentImportedId,
    cleared: true
  };
  const bankTransactions = await actual.getTransactions(
    source.id,
    payload.settlement.date,
    payload.settlement.date
  );
  const bankSide = one(
    bankTransactions.filter((item) =>
      item.amount === -payload.settlement.amountMinor && !item.transfer_id
    ),
    "Unverknüpfter Ausgleich"
  );
  const beforeCardCount = (await actual.getTransactions(card.id, "2026-01-01", "2026-12-31")).length;
  const beforeCardBalance = await actual.getAccountBalance(card.id);
  const uncategorized = cardRows.filter((item) => !item.category).length;
  const dry = await actual.importTransactions(card.id, [...cardRows, paymentRow], { dryRun: true });
  if (dry.errors.length) throw new Error(dry.errors.map((item) => item.message).join("; "));
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    statementDate: payload.statementDate,
    statementMinor: payload.balanceMinor,
    transactionCount: cardRows.length,
    categorized: cardRows.length - uncategorized,
    uncategorized,
    prospectiveAdded: dry.added?.length ?? 0,
    settlementFound: true
  }));
  if (!apply) {
    await actual.shutdown();
    process.exit(0);
  }

  const imported = await actual.importTransactions(card.id, [...cardRows, paymentRow], {
    defaultCleared: true
  });
  if (imported.errors.length) throw new Error(imported.errors.map((item) => item.message).join("; "));
  await actual.sync();
  let updatedCardRows = await actual.getTransactions(card.id, "2026-01-01", "2026-12-31");
  const cardSide = one(
    updatedCardRows.filter((item) => item.imported_id === paymentImportedId),
    "Karten-Ausgleichsgegenbuchung"
  );
  const payees = await actual.getPayees();
  const toCard = one(payees.filter((item) => item.transfer_acct === card.id), "Transferpayee zur Karte");
  const toSource = one(payees.filter((item) => item.transfer_acct === source.id), "Transferpayee zum Giro");
  await actual.updateTransaction(bankSide.id, {
    payee: toCard.id,
    transfer_id: cardSide.id,
    category: null,
    notes: `${bankSide.notes ?? ""} | Kreditkartenabrechnung ${payload.statementDate}`.trim()
  });
  await actual.updateTransaction(cardSide.id, {
    payee: toSource.id,
    transfer_id: bankSide.id,
    category: null,
    notes: `Kreditkartenabrechnung ${payload.statementDate}`
  });
  await actual.sync();

  updatedCardRows = await actual.getTransactions(card.id, "2026-01-01", "2026-12-31");
  const verifiedCardSide = one(
    updatedCardRows.filter((item) => item.imported_id === paymentImportedId),
    "Verifizierte Ausgleichsgegenbuchung"
  );
  const verifiedBankSide = one(
    (await actual.getTransactions(source.id, payload.settlement.date, payload.settlement.date))
      .filter((item) => item.id === bankSide.id),
    "Verifizierter Bankausgleich"
  );
  const afterCardBalance = await actual.getAccountBalance(card.id);
  if (verifiedCardSide.transfer_id !== verifiedBankSide.id
    || verifiedBankSide.transfer_id !== verifiedCardSide.id) {
    throw new Error("Ausgleich ist nicht beidseitig verknüpft");
  }
  if (updatedCardRows.length !== beforeCardCount + cardRows.length + 1) {
    throw new Error("Unerwartete Buchungszahl nach Import");
  }
  if (afterCardBalance !== beforeCardBalance) {
    throw new Error("Kartenkontosaldo hat sich trotz Ausgleich verändert");
  }
  console.log(JSON.stringify({
    applied: true,
    added: imported.added?.length ?? 0,
    transferLinked: true,
    accountBalancePreserved: true
  }));
  await actual.shutdown();
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
