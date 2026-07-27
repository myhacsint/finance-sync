import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { sha256 } from "../archive.js";
import type {
  ImportBundle,
  NormalizedTransaction,
  SourceConfig
} from "../types.js";

function decodeCsv(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(buffer)
      .replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function parseCsv(text: string, delimiter = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted) throw new Error("DKB-CSV enthält ein nicht geschlossenes Anführungszeichen");
  return rows;
}

function isoDate(value: string): string {
  const long = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (long) return `${long[3]}-${long[2]}-${long[1]}`;
  const short = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(value);
  if (short) return `20${short[3]}-${short[2]}-${short[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return iso[0];
  throw new Error(`Ungültiges DKB-Buchungsdatum: ${value}`);
}

function amountToMinor(value: string): bigint {
  const normalized = value
    .replace(/[\s\u00A0€]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error(`Ungültiger DKB-Betrag: ${value}`);
  const fraction = (match[3] ?? "").padEnd(2, "0");
  const amount = BigInt(match[2]) * 100n + BigInt(fraction || "0");
  return match[1] === "-" ? -amount : amount;
}

function requiredIndex(headers: string[], name: RegExp): number {
  const index = headers.findIndex((header) => name.test(header));
  if (index < 0) throw new Error(`DKB-CSV-Spalte fehlt: ${name.source}`);
  return index;
}

export function fetchDkbCsv(
  source: SourceConfig,
  inboxRoot: string
): ImportBundle {
  const configuredFile = String(source.settings?.file ?? "");
  const accountId = String(source.settings?.accountId ?? "");
  if (!configuredFile) throw new Error("settings.file fehlt");
  if (!accountId) throw new Error("settings.accountId fehlt");

  const root = resolve(inboxRoot);
  const file = resolve(root, configuredFile);
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    throw new Error("DKB-CSV liegt außerhalb des Dokument-Inbox");
  }

  const raw = readFileSync(file);
  const rows = parseCsv(decodeCsv(raw));
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => /^Buchungs(?:datum|tag)$/i.test(cell))
    && row.some((cell) => /^Betrag(?:\s*\(€\))?$/i.test(cell))
  );
  if (headerIndex < 0) throw new Error("DKB-CSV-Kopfzeile wurde nicht erkannt");
  const headers = rows[headerIndex];
  const bookedIndex = requiredIndex(headers, /^Buchungs(?:datum|tag)$/i);
  const valueIndex = requiredIndex(headers, /^Wertstellung$/i);
  const statusIndex = requiredIndex(headers, /^Status$/i);
  const debtorIndex = requiredIndex(headers, /^Zahlungspflichtige\*r$/i);
  const creditorIndex = requiredIndex(headers, /^Zahlungsempfänger\*in$/i);
  const memoIndex = requiredIndex(headers, /^Verwendungszweck$/i);
  const typeIndex = requiredIndex(headers, /^Umsatztyp$/i);
  const ibanIndex = requiredIndex(headers, /^IBAN$/i);
  const amountIndex = requiredIndex(headers, /^Betrag(?:\s*\(€\))?$/i);
  const dateFrom = String(source.settings?.dateFrom ?? "");
  const dateBefore = String(source.settings?.dateBefore ?? "");
  const rawHash = sha256(raw);
  const occurrences = new Map<string, number>();
  const transactions: NormalizedTransaction[] = [];

  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.some(Boolean) || row.length !== headers.length) continue;
    if (row[statusIndex] && row[statusIndex] !== "Gebucht") continue;
    const bookedAt = isoDate(row[bookedIndex]);
    if (dateFrom && bookedAt < dateFrom) continue;
    if (dateBefore && bookedAt >= dateBefore) continue;
    const amountMinor = amountToMinor(row[amountIndex]);
    const rowHash = sha256(JSON.stringify(row));
    const occurrence = (occurrences.get(rowHash) ?? 0) + 1;
    occurrences.set(rowHash, occurrence);
    const payee = amountMinor < 0n
      ? row[creditorIndex] || row[debtorIndex]
      : row[debtorIndex] || row[creditorIndex];
    const memo = [row[memoIndex], row[typeIndex]].filter(Boolean).join(" · ");
    transactions.push({
      sourceId: source.id,
      sourceTransactionId: `csv:${rowHash}:${occurrence}`,
      accountId,
      bookedAt,
      valueAt: row[valueIndex] ? isoDate(row[valueIndex]) : undefined,
      amountMinor,
      currency: "EUR",
      payee: payee || undefined,
      memo: memo || undefined,
      owner: source.owners?.join(", "),
      counterpartyIban: row[ibanIndex] || undefined,
      rawHash
    });
  }

  return {
    raw,
    rawMediaType: "text/csv",
    transactions
  };
}
