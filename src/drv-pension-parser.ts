import {
  PENSION_FIELD_KEYS,
  PENSION_FIELD_META,
  type PensionExtractedField,
  type PensionFieldKey
} from "./pension-document-types.js";

export interface PensionTextPage {
  page: number;
  text: string;
  method: "native" | "ocr";
  confidence: number;
}

function isoDate(value: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso ? null : iso;
}

function decimal(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function minor(value: string): string | null {
  const parsed = decimal(value);
  return parsed === null ? null : String(Math.round(parsed * 100));
}

interface Pattern {
  key: PensionFieldKey;
  expressions: RegExp[];
  transform(value: string): string | null;
}

const date = "(\\d{2}\\.\\d{2}\\.\\d{4})";
const money = "([\\d.]+,\\d{2})";
const points = "([\\d.]+,\\d{4})";

const patterns: Pattern[] = [
  {
    key: "documentDate",
    expressions: [
      new RegExp(`Renteninformation(?:\\s+vom)?\\s*${date}`, "i"),
      new RegExp(`Dokumentdatum\\s*:?\\s*${date}`, "i"),
      new RegExp(`Datum\\s*:?\\s*${date}`, "i")
    ],
    transform: isoDate
  },
  {
    key: "dataThrough",
    expressions: [
      new RegExp(`(?:Daten|Versicherungsverlauf|Zeiten|Beiträge)[^\\n.]{0,100}?(?:bis|bis zum)\\s*${date}`, "i"),
      new RegExp(`berücksichtigt(?:en Daten)?[^\\n.]{0,80}?(?:bis|bis zum)\\s*${date}`, "i"),
      new RegExp(`Datenstand\\s*:?\\s*${date}`, "i")
    ],
    transform: isoDate
  },
  {
    key: "pensionStart",
    expressions: [
      new RegExp(`(?:regulärer |Regelalters)?Rentenbeginn\\s*:?\\s*${date}`, "i"),
      new RegExp(`Regelaltersrente[^\\n.]{0,100}?(?:beginnt|beginnen|ab)\\s*(?:am)?\\s*${date}`, "i"),
      new RegExp(`Rente[^\\n.]{0,80}?ab\\s*${date}`, "i")
    ],
    transform: isoDate
  },
  {
    key: "earnedPoints",
    expressions: [
      new RegExp(`(?:insgesamt\\s*)?${points}\\s*Entgeltpunkte`, "i"),
      new RegExp(`Entgeltpunkte\\s*:?\\s*${points}`, "i")
    ],
    transform: (value) => decimal(value)?.toFixed(4) ?? null
  },
  {
    key: "earnedMonthlyGrossMinor",
    expressions: [
      new RegExp(`(?:bislang|bisher)[^\\n.]{0,120}?(?:monatliche |Regelalters)?rente[^\\d]{0,30}${money}\\s*(?:EUR|€)`, "i"),
      new RegExp(`erworbene(?:n)?[^\\n.]{0,100}?Rente[^\\d]{0,30}${money}\\s*(?:EUR|€)`, "i"),
      new RegExp(`monatliche Rente von\\s*${money}\\s*(?:EUR|€)[^\\n.]{0,80}?(?:erworben|bisher)`, "i")
    ],
    transform: minor
  },
  {
    key: "projectedMonthlyGrossMinor",
    expressions: [
      new RegExp(`(?:Prognose|voraussichtlich|hochgerechnet)[^\\n.]{0,180}?(?:monatliche |Regelalters)?rente[^\\d]{0,30}${money}\\s*(?:EUR|€)`, "i"),
      new RegExp(`Beiträge[^\\n.]{0,220}?(?:Durchschnitt|weiter)[^\\n.]{0,220}?monatliche Rente(?: von)?\\s*${money}\\s*(?:EUR|€)`, "i"),
      new RegExp(`monatliche Rente(?: von)?\\s*${money}\\s*(?:EUR|€)[^\\n.]{0,220}?(?:Beiträge|Durchschnitt der letzten fünf)`, "i")
    ],
    transform: minor
  },
  {
    key: "currentPensionValueMinor",
    expressions: [
      new RegExp(`aktueller Rentenwert\\s*:?\\s*${money}\\s*(?:EUR|€)`, "i"),
      new RegExp(`Rentenwert[^\\d]{0,30}${money}\\s*(?:EUR|€)`, "i")
    ],
    transform: minor
  }
];

function normalized(text: string): string {
  return text
    .replace(/\u00ad/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function parseDrvPensionPages(pages: PensionTextPage[]): PensionExtractedField[] {
  const candidates = new Map<PensionFieldKey, PensionExtractedField[]>();
  for (const page of pages) {
    const content = normalized(page.text);
    for (const pattern of patterns) {
      for (const expression of pattern.expressions) {
        const match = expression.exec(content);
        const value = match?.[1] ? pattern.transform(match[1]) : null;
        if (!value) continue;
        const list = candidates.get(pattern.key) ?? [];
        list.push({
          key: pattern.key,
          label: PENSION_FIELD_META[pattern.key].label,
          value,
          unit: PENSION_FIELD_META[pattern.key].unit,
          page: page.page,
          confidence: Math.max(0, Math.min(1, page.confidence)),
          confidenceLabel: page.confidence >= 0.88 ? "hoch" : "prüfen",
          extractionMethod: page.method,
          validatorCodes: [],
          status: "EXTRACTED"
        });
        candidates.set(pattern.key, list);
        break;
      }
    }
  }
  return PENSION_FIELD_KEYS.map((key) => {
    const values = candidates.get(key) ?? [];
    const unique = [...new Map(values.map((item) => [item.value, item])).values()];
    if (unique.length === 0) {
      return {
        key,
        label: PENSION_FIELD_META[key].label,
        value: "",
        unit: PENSION_FIELD_META[key].unit,
        page: 0,
        confidence: 0,
        confidenceLabel: "fehlt",
        extractionMethod: "manual",
        validatorCodes: ["FIELD_MISSING"],
        status: "EXTRACTED"
      };
    }
    const selected = unique.sort((a, b) => b.confidence - a.confidence)[0];
    if (unique.length > 1) {
      selected.confidenceLabel = "prüfen";
      selected.validatorCodes.push("FIELD_AMBIGUOUS");
    }
    return selected;
  });
}
