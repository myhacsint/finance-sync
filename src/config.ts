import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "./types.js";

export const paths = {
  data: process.env.FINANCE_DATA_DIR ?? "/app/data",
  archive: process.env.FINANCE_ARCHIVE_DIR ?? "/archive",
  inbox: process.env.FINANCE_INBOX_DIR ?? "/inbox",
  secrets: process.env.FINANCE_SECRETS_DIR ?? "/run/secrets",
  backup: process.env.FINANCE_BACKUP_DIR ?? "/backup"
};

const defaultConfig: AppConfig = {
  port: Number(process.env.PORT ?? 8080),
  timezone: process.env.TZ ?? "Europe/Berlin",
  sources: [],
  actual: {
    enabled: false,
    serverUrl: "http://ActualServer:5006",
    budgetId: "",
    dataDir: join(paths.data, "actual-cache"),
    accountMap: {}
  },
  ghostfolio: {
    enabled: false,
    serverUrl: "http://Ghostfolio:3333",
    accountMap: {}
  }
};

export function loadConfig(): AppConfig {
  const configPath = process.env.FINANCE_CONFIG ?? join(paths.data, "config.json");
  if (!existsSync(configPath)) return defaultConfig;
  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Partial<AppConfig>;
  return {
    ...defaultConfig,
    ...parsed,
    actual: parsed.actual ? { ...defaultConfig.actual!, ...parsed.actual } : defaultConfig.actual,
    ghostfolio: parsed.ghostfolio
      ? { ...defaultConfig.ghostfolio!, ...parsed.ghostfolio }
      : defaultConfig.ghostfolio,
    analysis: parsed.analysis ? {
      ...parsed.analysis,
      savingsBaseline: parsed.analysis.savingsBaseline
        ? {
            manualForwardedIncomeMerchantKeys:
              parsed.analysis.savingsBaseline.manualForwardedIncomeMerchantKeys
                ?.filter((key) => /^merchant-[a-f0-9]{16}$/.test(key))
          }
        : undefined,
      expenseStructure: parsed.analysis.expenseStructure
        ? { ...parsed.analysis.expenseStructure }
        : undefined,
      cryptoPosition: parsed.analysis.cryptoPosition
        ? { ...parsed.analysis.cryptoPosition }
        : undefined
    } : undefined,
    sources: parsed.sources ?? [],
    physicalAssets: parsed.physicalAssets ?? []
  };
}

export function readSecret(name: string): string | undefined {
  const file = join(paths.secrets, name);
  if (!existsSync(file)) return undefined;
  const value = readFileSync(file, "utf8").trim();
  return value || undefined;
}
