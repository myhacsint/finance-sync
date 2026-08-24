export interface MerchantRule {
  pattern: string;
  label: string;
}

export interface DisplayMerchantRule extends MerchantRule {
  deletable: boolean;
}

export const DEFAULT_MERCHANT_RULES: MerchantRule[] = [
  { pattern: "amazon", label: "Amazon" },
  { pattern: "anthropic", label: "Anthropic Claude Subscription" },
  { pattern: "claude ai subscription", label: "Anthropic Claude Subscription" },
  { pattern: "openai", label: "OpenAI / ChatGPT" },
  { pattern: "chatgpt", label: "OpenAI / ChatGPT" },
  { pattern: "paypal", label: "PayPal" },
  { pattern: "hetzner online", label: "Hetzner Online" },
  { pattern: "tipp24", label: "Tipp24" },
  { pattern: "eschacher liftbetriebe", label: "Eschacher Liftbetriebe" },
  { pattern: "fraport parken", label: "Fraport Parken" },
  { pattern: "jufa hotel", label: "JUFA Hotels" },
  { pattern: "rhoen park hotel", label: "Rhön Park Hotel" },
  { pattern: "bauhaus", label: "BAUHAUS" },
  { pattern: "friedrich report", label: "Friedrich Report" },
  { pattern: "bye.bye", label: "Bye.Bye" },
  { pattern: "mvz labor", label: "MVZ Labor" }
];

export function normalizeMerchantLabel(value: string): string {
  return value.toLocaleLowerCase("de-DE").replace(/[^a-z0-9äöüß]+/g, " ").trim();
}

export function mergeMerchantRules(
  base: MerchantRule[],
  extra: MerchantRule[] = []
): MerchantRule[] {
  const merged = [...extra, ...base];
  const seen = new Set<string>();
  return merged.filter((rule) => {
    const key = `${normalizeMerchantLabel(rule.pattern)}=>${rule.label}`;
    if (!rule.pattern.trim() || !rule.label.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function merchantRuleBook(
  base: MerchantRule[],
  persisted: MerchantRule[] = []
): DisplayMerchantRule[] {
  const persistedKeys = new Set(
    persisted.map((rule) => `${normalizeMerchantLabel(rule.pattern)}=>${rule.label}`)
  );
  return mergeMerchantRules(base, persisted).map((rule) => ({
    ...rule,
    deletable: persistedKeys.has(`${normalizeMerchantLabel(rule.pattern)}=>${rule.label}`)
  }));
}

export function applyMerchantRules(
  value: string,
  rules: MerchantRule[] = DEFAULT_MERCHANT_RULES
): { key: string; label: string } {
  const normalized = normalizeMerchantLabel(value);
  for (const rule of rules) {
    const pattern = normalizeMerchantLabel(rule.pattern);
    if (!pattern) continue;
    if (normalized.includes(pattern) || (pattern === "bauhaus" && /^bauhaus(?:\b|\s)/.test(normalized))) {
      return { key: normalizeMerchantLabel(rule.label) || pattern, label: rule.label };
    }
  }
  return { key: normalized || "unbekannt", label: value.trim() || "Unbekannter Händler" };
}
