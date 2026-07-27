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

export interface SourceConfig {
  id: string;
  kind: SourceKind;
  enabled: boolean;
  scheduleHours?: number;
  owners?: string[];
  settings?: Record<string, unknown>;
}

export interface AppConfig {
  port: number;
  publicBaseUrl?: string;
  timezone: string;
  sources: SourceConfig[];
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
}
