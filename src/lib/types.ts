export type Asset = {
  id: string;
  name: string;
  ticker: string | null;
  type: string;
  quantity: number | null;
  costBasis: number;
  currentValue: number;
  currency: string;
  purchaseDate: string | null;
  notes: string | null;
};

export type Account = {
  id: string;
  name: string;
  institution: string | null;
  type: string;
  currency: string;
  balance: number;
  notes: string | null;
};

export type RecurringIncome = {
  id: string;
  assetId: string;
  name: string;
  amount: number;
  currency: string;
  frequency: string;
  nextDate: string;
  notes: string | null;
  accountId: string | null;
  /** INCOME (default) or EXPENSE — amount always stored positive */
  direction: "INCOME" | "EXPENSE";
};

export type Tx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: string;
  category: string | null;
  assetId: string | null;
  accountId: string | null;
};

export type Fx = {
  official: number;
  blue: number;
  mep: number;
  average: number;
};

export type Snapshot = {
  date: string;
  totalUsd: number;
};

export type Liability = {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  interestRate: number | null;
  linkedAssetId: string | null;
  notes: string | null;
};

export type Goal = {
  id: string;
  name: string;
  targetUsd: number;
  targetDate: string | null;
  notes: string | null;
};

export type AllocTarget = {
  assetType: string;
  targetPct: number;
};

export type FxHistoryRow = {
  date: string;
  official: number;
  blue: number;
  mep: number;
  average: number;
};

export type AppSettings = {
  pinEnabled: boolean;
  hasPin: boolean;
};

export type TaxLot = {
  id: string;
  assetId: string;
  quantity: number;
  costPerUnit: number;
  currency: string;
  purchasedAt: string;
  notes: string | null;
};

export type WatchItem = {
  id: string;
  ticker: string;
  name: string | null;
  type: string;
  lastPrice: number | null;
  currency: string;
  notes: string | null;
};

export type Portfolio = {
  assets: Asset[];
  accounts: Account[];
  recurring: RecurringIncome[];
  transactions: Tx[];
  snapshots: Snapshot[];
  fx: Fx;
  liabilities: Liability[];
  goals: Goal[];
  allocTargets: AllocTarget[];
  fxHistory: FxHistoryRow[];
  settings: AppSettings;
  taxLots: TaxLot[];
  watchlist: WatchItem[];
  /** ISO timestamp of the last price refresh, or null if it never ran. */
  lastPriceRun: string | null;
};
