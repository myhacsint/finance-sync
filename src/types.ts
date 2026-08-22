export type SourceKind =
  | "enable-banking"
  | "dkb-csv"
  | "comdirect"
  | "dkb-fints"
  | "solana"
  | "manual";

export type SyncState =
  | "DISABLED"
  | "READY"
  | "RUNNING"
  | "SUCCESS"
  | "WAITING_FOR_USER"
  | "ERROR";

export type ExpenseClass =
  | "VERTRAGLICH"
  | "STRUKTURELL"
  | "GRUNDBEDARF"
  | "DISPOSITIV"
  | "UNBEKANNT";

export type RecurringExpenseDecision =
  | "GRUNDBEDARF"
  | "GESTALTBAR"
  | "VERMEIDBAR"
  | "UNKLAR"
  | "KEIN_KANDIDAT";

export interface RecurringExpenseDecisionRecord {
  candidateKey: string;
  decision: RecurringExpenseDecision;
  evidenceHash: string;
  fingerprintVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type RecurringExpenseOptimizationStatus =
  | "PRUEFEN"
  | "GEPLANT"
  | "GEKUENDIGT"
  | "BEIBEHALTEN";

export type RecurringExpenseOptimizationPriority = "HOCH" | "MITTEL" | "NIEDRIG";

export interface RecurringExpenseOptimizationRecord {
  candidateKey: string;
  evidenceHash: string;
  status: RecurringExpenseOptimizationStatus;
  effectiveDate: string | null;
  expectedAnnualSavingsMinor: number | null;
  priority: RecurringExpenseOptimizationPriority | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseAnalysisAdjustment {
  id: string;
  label: string;
  category: string;
  class: ExpenseClass;
  year: number;
  amountMinor?: number;
  annualAmountMinor?: number;
  prorateCompletedMonths?: boolean;
  estimate?: boolean;
  note?: string;
}

export interface ExpenseAnalysisOverride {
  merchantContains?: string;
  notesContains?: string;
  categoryEquals?: string;
  dateEquals?: string;
  amountMinor?: number;
  category?: string;
  class?: ExpenseClass;
}

export type CryptoEvidenceStatus = "Bestaetigt" | "Sehr wahrscheinlich" | "Unklar";

export interface CryptoTaxYearConfig {
  year: number;
  status: "review" | "likely-tax-free" | "below-threshold" | "future-filing";
  title: string;
  detail: string;
  confidence: CryptoEvidenceStatus;
  referenceMinor?: number;
  referenceLabel?: string;
  estimate?: boolean;
}

export interface CryptoPositionAnalysisConfig {
  capturedAt: string;
  scopeStartYear: number;
  holdings: {
    liquidSolAtomic: string;
    delegatedSolAtomic: string;
    undelegatedStakeSolAtomic: string;
    rentReserveSolAtomic: string;
    inactiveStakeSolAtomic: string;
    rewardsSolAtomic: string;
  };
  transition: {
    occurredAt: string;
    inputEth: number;
    outputSolAtomic: string;
    valueEurMinor: number;
    valueUsdMinor: number;
    confidence: CryptoEvidenceStatus;
  };
  capital: {
    currentPositionBasisEurMinor: number;
    currentPositionBasisUsdMinor: number;
    grossFiatContributionsEurMinor: number;
    grossFiatContributionsUsdMinor: number;
    fiatWithdrawalsEurMinor: number;
    fiatWithdrawalsUsdMinor: number;
    netFiatCapitalEurMinor: number;
    netFiatCapitalUsdMinor: number;
  };
  taxYears: CryptoTaxYearConfig[];
  evidence: Array<{
    label: string;
    detail: string;
    confidence: CryptoEvidenceStatus;
  }>;
}

export interface SourceConfig {
  id: string;
  kind: SourceKind;
  enabled: boolean;
  scheduleHours?: number;
  owners?: string[];
  settings?: Record<string, unknown>;
}

export interface PhysicalAssetValuationConfig {
  date: string;
  amountMinor: number;
  basis: string;
  source: string;
  estimated: boolean;
}

export interface PhysicalAssetConfig {
  id: string;
  label: string;
  kind: "gold";
  weightGrams: number;
  fineness: number;
  acquiredYear?: number;
  acquisitionCostMinor?: number;
  acquisitionCostEstimated?: boolean;
  valuations: PhysicalAssetValuationConfig[];
}

export interface AppConfig {
  port: number;
  publicBaseUrl?: string;
  timezone: string;
  sources: SourceConfig[];
  physicalAssets?: PhysicalAssetConfig[];
  actual?: {
    enabled: boolean;
    serverUrl: string;
    budgetId: string;
    dataDir: string;
    accountMap: Record<string, string>;
  };
  ghostfolio?: {
    enabled: boolean;
    serverUrl: string;
    accountMap: Record<string, string>;
    holdingMap?: Record<string, {
      dataSource: string;
      symbol: string;
      currency?: string;
    }>;
  };
  analysis?: {
    expenseStructure?: {
      oldestYear?: number;
      categoryClasses?: Record<string, ExpenseClass>;
      overrides?: ExpenseAnalysisOverride[];
      adjustments?: ExpenseAnalysisAdjustment[];
    };
    cryptoPosition?: CryptoPositionAnalysisConfig;
  };
}

export interface NormalizedTransaction {
  sourceId: string;
  sourceTransactionId?: string;
  accountId: string;
  bookedAt: string;
  valueAt?: string;
  amountMinor: bigint;
  currency: string;
  payee?: string;
  memo?: string;
  category?: string;
  owner?: string;
  counterpartyIban?: string;
  internalTransferId?: string;
  rawHash: string;
}

export interface NormalizedBalance {
  sourceId: string;
  accountId: string;
  capturedAt: string;
  amountMinor: bigint;
  currency: string;
  owner?: string;
  rawHash: string;
}

export interface NormalizedHolding {
  sourceId: string;
  accountId: string;
  capturedAt: string;
  symbol: string;
  name?: string;
  quantityAtomic: string;
  atomicDecimals: number;
  priceMinor?: bigint;
  currency?: string;
  priceAtomic?: string;
  priceDecimals?: number;
  priceCurrency?: string;
  marketValueMinor?: bigint;
  marketValueCurrency?: string;
  owner?: string;
  rawHash: string;
}

export interface NormalizedActivity {
  sourceId: string;
  sourceActivityId?: string;
  accountId: string;
  occurredAt: string;
  type: string;
  symbol?: string;
  quantityAtomic?: string;
  atomicDecimals?: number;
  amountMinor?: bigint;
  currency?: string;
  feeMinor?: bigint;
  note?: string;
  rawHash: string;
}

export interface ImportBundle {
  raw: unknown;
  rawMediaType?: string;
  transactions?: NormalizedTransaction[];
  balances?: NormalizedBalance[];
  holdings?: NormalizedHolding[];
  activities?: NormalizedActivity[];
}

export interface SyncResult {
  state: SyncState;
  message: string;
  counts?: Record<string, number>;
  challenge?: string;
  decoupled?: boolean;
}
