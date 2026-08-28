import type { PensionTextPage } from "./drv-pension-parser.js";
import type { ParsedSutorStatement, SutorPosition } from "./sutor-document-types.js";

function isoDate(value: string): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) throw new Error("SUTOR_DATE_INVALID");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function decimalAtomic(value: string): { atomic: string; decimals: number } {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "");
  if (!/^-?\d+(?:,\d+)?$/.test(normalized)) throw new Error("SUTOR_NUMBER_INVALID");
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ""] = unsigned.split(",");
  const atomic = `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  return { atomic: `${negative ? "-" : ""}${atomic}`, decimals: fraction.length };
}

function moneyMinor(value: string): string {
  const parsed = decimalAtomic(value);
  if (parsed.decimals !== 2) throw new Error("SUTOR_MONEY_INVALID");
  return parsed.atomic;
}

function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("SUTOR_NUMBER_INVALID");
  return (numerator + denominator / 2n) / denominator;
}

function pow10(value: number): bigint { return 10n ** BigInt(value); }

export function validIsin(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) return false;
  const expanded = isin.split("").map((character) => /\d/.test(character)
    ? character
    : String(character.charCodeAt(0) - 55)).join("");
  let sum = 0;
  let double = false;
  for (let index = expanded.length - 1; index >= 0; index -= 1) {
    let digit = Number(expanded[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function expectedMarketValueMinor(position: Omit<SutorPosition, "ghostfolioMapped" | "validatorCodes">): bigint {
  const quantity = BigInt(position.quantityAtomic);
  const price = BigInt(position.priceAtomic);
  const baseDenominator = pow10(position.quantityDecimals + position.priceDecimals);
  if (position.priceCurrency === "EUR") return roundDiv(quantity * price * 100n, baseDenominator);
  if (!position.fxRateAtomic || position.fxRateDecimals === null) throw new Error("SUTOR_FX_MISSING");
  return roundDiv(
    quantity * price * 100n * pow10(position.fxRateDecimals),
    baseDenominator * BigInt(position.fxRateAtomic)
  );
}

function positionCodes(position: Omit<SutorPosition, "ghostfolioMapped" | "validatorCodes">): string[] {
  const codes: string[] = [];
  if (!validIsin(position.isin)) codes.push("ISIN_INVALID");
  if (BigInt(position.quantityAtomic) <= 0n) codes.push("QUANTITY_INVALID");
  if (BigInt(position.priceAtomic) <= 0n) codes.push("PRICE_INVALID");
  if (BigInt(position.marketValueMinor) < 0n) codes.push("MARKET_VALUE_INVALID");
  if (position.priceCurrency === "USD" && (!position.fxRateAtomic || BigInt(position.fxRateAtomic) <= 0n)) {
    codes.push("FX_MISSING");
  }
  try {
    const difference = expectedMarketValueMinor(position) - BigInt(position.marketValueMinor);
    if (difference < -2n || difference > 2n) codes.push("POSITION_VALUE_MISMATCH");
  } catch {
    if (!codes.includes("FX_MISSING")) codes.push("POSITION_VALUE_MISMATCH");
  }
  if (position.provenance.method === "ocr" || position.provenance.confidence < 0.9) codes.push("OCR_REVIEW_REQUIRED");
  return [...new Set(codes)];
}

function cleanFundName(value: string): string {
  return value.replace(/^Fonds\s+/i, "").replace(/\s+/g, " ").trim();
}

export function parseSutorStatementPages(pages: PensionTextPage[]): ParsedSutorStatement {
  const dates: Array<{ value: string; page: number }> = [];
  let holdingsPage: PensionTextPage | undefined;
  for (const page of pages) {
    for (const match of page.text.matchAll(/Aufstellung über (?:die\s+)?Kundenfinanzinstrumente\s+per\s+(\d{2}\.\d{2}\.\d{4})/gi)) {
      dates.push({ value: isoDate(match[1]), page: page.page });
    }
    if (/Investment\s+ISIN[\s\S]{0,180}Anlagequote[\s\S]{0,120}Kurswert/i.test(page.text)) holdingsPage = page;
  }
  if (!holdingsPage) throw new Error("SUTOR_HOLDINGS_TABLE_MISSING");
  const statementDate = dates[0]?.value;
  if (!statementDate || dates.length < 2) throw new Error("SUTOR_STATEMENT_DATES_MISSING");
  if (dates.some((date) => date.value !== statementDate)) throw new Error("SUTOR_STATEMENT_DATES_CONFLICT");

  const fxMatch = /Währungskurs:\s*([\d.]+,\d+)\s*US\$/i.exec(holdingsPage.text);
  const fx = fxMatch ? decimalAtomic(fxMatch[1]) : null;
  const rowPattern = /^\s*(.+?)\s+([A-Z]{2}[A-Z0-9]{9}\d)\s+.+?\s+(\d{1,3},\d{2})\s*%\s+([\d.]+,\d+)\s+Anteile\s+([\d.]+,\d+)\s+(EUR|US\$\*?)\s+(-?[\d.]+,\d{2})\s+EUR\s*$/gmi;
  const positions: ParsedSutorStatement["positions"] = [];
  for (const match of holdingsPage.text.matchAll(rowPattern)) {
    const quantity = decimalAtomic(match[4]);
    const price = decimalAtomic(match[5]);
    const priceCurrency = match[6].startsWith("US$") ? "USD" : "EUR";
    const base = {
      isin: match[2],
      fundName: cleanFundName(match[1]),
      allocationBps: Math.round(Number(match[3].replace(",", ".")) * 100),
      quantityAtomic: quantity.atomic,
      quantityDecimals: quantity.decimals,
      priceAtomic: price.atomic,
      priceDecimals: price.decimals,
      priceCurrency,
      marketValueMinor: moneyMinor(match[7]),
      fxRateAtomic: priceCurrency === "USD" ? fx?.atomic ?? null : null,
      fxRateDecimals: priceCurrency === "USD" ? fx?.decimals ?? null : null,
      provenance: {
        page: holdingsPage.page,
        confidence: holdingsPage.confidence,
        method: holdingsPage.method
      }
    } satisfies Omit<SutorPosition, "ghostfolioMapped" | "validatorCodes">;
    positions.push({ ...base, validatorCodes: positionCodes(base) });
  }
  if (positions.length === 0) throw new Error("SUTOR_POSITIONS_MISSING");
  const unique = new Set(positions.map((position) => position.isin));
  if (unique.size !== positions.length) throw new Error("SUTOR_ISIN_DUPLICATE");

  const totalMatch = /Kurswert Gesamt\s+([\d.]+,\d{2})\s+EUR/i.exec(holdingsPage.text);
  const cashMatch = /Geldsaldo\s+(-?[\d.]+,\d{2})\s+EUR/i.exec(holdingsPage.text);
  if (!totalMatch) throw new Error("SUTOR_TOTAL_MISSING");
  if (!cashMatch) throw new Error("SUTOR_CASH_MISSING");
  const totalMarketValueMinor = moneyMinor(totalMatch[1]);
  const cashMinor = moneyMinor(cashMatch[1]);
  const positionTotal = positions.reduce((sum, position) => sum + BigInt(position.marketValueMinor), 0n);
  if (positionTotal !== BigInt(totalMarketValueMinor)) throw new Error("SUTOR_POSITION_SUM_MISMATCH");
  const contractValueMinor = (BigInt(totalMarketValueMinor) + BigInt(cashMinor)).toString();
  if (BigInt(contractValueMinor) < 0n) throw new Error("SUTOR_CONTRACT_VALUE_INVALID");
  const extractionMethod = positions.some((position) => position.provenance.method === "ocr") ? "ocr" : "native";
  const warnings = [...new Set(positions.flatMap((position) => position.validatorCodes))];
  return {
    documentType: "Sutor Depotauszug",
    statementDate,
    statementDateOccurrences: dates,
    positions,
    totalMarketValueMinor,
    cashMinor,
    contractValueMinor,
    totalProvenance: { page: holdingsPage.page, confidence: holdingsPage.confidence, method: holdingsPage.method },
    cashProvenance: { page: holdingsPage.page, confidence: holdingsPage.confidence, method: holdingsPage.method },
    extractionMethod,
    warnings
  };
}
