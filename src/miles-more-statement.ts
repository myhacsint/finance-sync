import { createHash } from "node:crypto";

export interface MilesMoreStatementTransaction {
  importedId: string;
  purchaseDate: string;
  bookingDate: string;
  payee: string;
  rawPayee: string;
  amountMinor: number;
  foreignFeeMinor: number;
  categoryName?: string;
  notes: string;
}

export interface MilesMoreStatement {
  statementDate: string;
  balanceMinor: number;
  transactions: MilesMoreStatementTransaction[];
}

function dateToIso(value: string): string {
  const [day, month, year] = value.split(".");
  return `${year}-${month}-${day}`;
}

function moneyToMinor(value: string): number {
  return Math.round(Number(value.replaceAll(".", "").replace(",", ".")) * 100);
}

function canonicalPayee(raw: string): { payee: string; categoryName?: string } {
  const value = raw.trim();
  if (/^GITHUB\b/i.test(value)) return { payee: "GitHub", categoryName: "Homelab & IT" };
  if (/STRIPE-Z\.AI/i.test(value)) return { payee: "Z.AI", categoryName: "Homelab & IT" };
  if (/ANTHROPIC\*?\s+CLAUDE/i.test(value)) {
    return { payee: "Anthropic Claude Subscription", categoryName: "Homelab & IT" };
  }
  if (/^TIDAL\b/i.test(value)) return { payee: "Tidal", categoryName: "Abonnements" };
  if (/^MONATLICHER KARTENPREIS$/i.test(value)) {
    return { payee: "Monatlicher Kartenpreis", categoryName: "Bankgebühren" };
  }
  return {
    payee: value
      .replace(/,\s*(DEU|SWE|USA)$/i, "")
      .replace(/\s+/g, " ")
      .trim()
  };
}

function importedId(
  statementDate: string,
  purchaseDate: string,
  bookingDate: string,
  rawPayee: string,
  amountMinor: number
): string {
  const digest = createHash("sha256")
    .update([statementDate, purchaseDate, bookingDate, rawPayee, amountMinor].join("|"))
    .digest("hex")
    .slice(0, 24);
  return `miles-more:${statementDate}:${digest}`;
}

export function parseMilesMoreStatement(text: string, statementDate: string): MilesMoreStatement {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(statementDate)) {
    throw new Error("Abrechnungsdatum muss YYYY-MM-DD sein");
  }
  const rows: Array<Omit<MilesMoreStatementTransaction, "importedId" | "notes">> = [];
  let balanceMinor: number | undefined;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/\s+/g, " ");
    const balance = /^Saldo\s+(-?[\d.]+,\d{2})$/i.exec(line);
    if (balance) {
      balanceMinor = moneyToMinor(balance[1]);
      continue;
    }
    const fee = /AUSLANDSEINSATZENTGELT\s+(-?[\d.]+,\d{2})$/i.exec(line);
    if (fee) {
      const previous = rows.at(-1);
      if (!previous) throw new Error("Auslandseinsatzentgelt ohne zugehörigen Umsatz");
      const feeMinor = moneyToMinor(fee[1]);
      previous.amountMinor += feeMinor;
      previous.foreignFeeMinor += feeMinor;
      continue;
    }
    const transaction = /^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}\.\d{2}\.\d{4})\s+(.+?)\s+(-?[\d.]+,\d{2})$/.exec(line);
    if (!transaction) continue;
    const [, purchase, booking, descriptionWithFx, amount] = transaction;
    const rawPayee = descriptionWithFx
      .replace(/\s+[A-Z]{3}\s+-?[\d.]+,\d{2}\s+[\d.,]+$/, "")
      .trim();
    const canonical = canonicalPayee(rawPayee);
    rows.push({
      purchaseDate: dateToIso(purchase),
      bookingDate: dateToIso(booking),
      payee: canonical.payee,
      rawPayee,
      amountMinor: moneyToMinor(amount),
      foreignFeeMinor: 0,
      categoryName: canonical.categoryName
    });
  }
  if (balanceMinor === undefined) throw new Error("Abrechnungssaldo fehlt");
  if (rows.length === 0) throw new Error("Keine Kreditkartenumsätze erkannt");
  const total = rows.reduce((sum, row) => sum + row.amountMinor, 0);
  if (total !== balanceMinor) {
    throw new Error(`Abrechnung stimmt nicht: Umsätze ${total}, Saldo ${balanceMinor}`);
  }
  return {
    statementDate,
    balanceMinor,
    transactions: rows.map((row) => ({
      ...row,
      importedId: importedId(
        statementDate,
        row.purchaseDate,
        row.bookingDate,
        row.rawPayee,
        row.amountMinor
      ),
      notes: `Abrechnung KK-${statementDate.slice(0, 7)}`
        + (row.foreignFeeMinor < 0
          ? ` | Auslandseinsatzentgelt ${Math.abs(row.foreignFeeMinor / 100).toFixed(2).replace(".", ",")} EUR im Betrag enthalten`
          : "")
    }))
  };
}
