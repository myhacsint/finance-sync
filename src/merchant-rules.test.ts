import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MERCHANT_RULES,
  applyMerchantRules,
  merchantRuleBook,
  mergeMerchantRules
} from "./merchant-rules.js";

test("Standardregeln bündeln Amazon, Claude, OpenAI und PayPal", () => {
  const grouped = [
    "Amazon Payments Europe S.C.A.",
    "Amazon Media Eu S.A R.L.",
    "Anthropic Claude Subscription",
    "Claude.Ai Subscription",
    "Openai Ireland Limited",
    "Paypal Etsy Ireland",
    "Ginge Technology"
  ].map((name) => applyMerchantRules(name));
  assert.deepEqual(grouped.map((item) => item.label), [
    "Amazon",
    "Amazon",
    "Anthropic Claude Subscription",
    "Anthropic Claude Subscription",
    "OpenAI / ChatGPT",
    "PayPal",
    "Ginge Technology"
  ]);
});

test("zusätzliche persistierte Regeln überschreiben die Defaults", () => {
  const rules = mergeMerchantRules(DEFAULT_MERCHANT_RULES, [
    { pattern: "ginge", label: "Ginge" }
  ]);
  assert.equal(applyMerchantRules("Ginge Technology", rules).label, "Ginge");
  assert.equal(applyMerchantRules("Amazon EU SARL", rules).label, "Amazon");
});

test("nur persistierte Händlerregeln werden als löschbar ausgewiesen", () => {
  const rules = merchantRuleBook(DEFAULT_MERCHANT_RULES, [
    { pattern: "ginge", label: "Ginge" }
  ]);
  assert.equal(rules.find((rule) => rule.pattern === "ginge")?.deletable, true);
  assert.equal(rules.find((rule) => rule.pattern === "amazon")?.deletable, false);
});
