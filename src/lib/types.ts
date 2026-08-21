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

export type Portfolio = {
  assets: Asset[];
  accounts: Account[];
  recurring: RecurringIncome[];
  transactions: Tx[];
  snapshots: Snapshot[];
  fx: Fx;
};
