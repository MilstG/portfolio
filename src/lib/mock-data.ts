export const exchangeRate = {
  official: 1420,
  blue: 1480,
  mep: 1455,
  average: 1451.67,
};

export const netWorth = {
  totalUsd: 124850,
  changePercent: 2.4,
  changeAmount: 2920,
};

export const allocation = [
  { name: "Crypto", value: 42300, percent: 33.9, color: "#8b5cf6" },
  { name: "Stocks", value: 38100, percent: 30.5, color: "#3b82f6" },
  { name: "Real Estate", value: 35000, percent: 28.0, color: "#14b8a6" },
  { name: "Cash", value: 9450, percent: 7.6, color: "#6b7280" },
];

export const netWorthHistory = [
  { month: "May '25", value: 78000 },
  { month: "Jun '25", value: 82000 },
  { month: "Jul '25", value: 85500 },
  { month: "Aug '25", value: 89000 },
  { month: "Sep '25", value: 91000 },
  { month: "Oct '25", value: 94500 },
  { month: "Nov '25", value: 98000 },
  { month: "Dec '25", value: 102000 },
  { month: "Jan '26", value: 108000 },
  { month: "Feb '26", value: 112500 },
  { month: "Mar '26", value: 117000 },
  { month: "Apr '26", value: 121000 },
  { month: "May '26", value: 124850 },
];

export const cashAccounts = [
  {
    id: "1",
    name: "Banco Galicia ARS",
    institution: "Banco Galicia",
    type: "bank",
    currency: "ARS",
    balance: 2450000,
    balanceUsd: 1688,
    lastUpdated: "Hoy, 09:41",
  },
  {
    id: "2",
    name: "Banco Santander USD",
    institution: "Banco Santander",
    type: "bank",
    currency: "USD",
    balance: 4200,
    balanceUsd: 4200,
    lastUpdated: "Hoy, 08:15",
  },
  {
    id: "3",
    name: "Binance USDT",
    institution: "Binance",
    type: "exchange",
    currency: "USDT",
    balance: 3150,
    balanceUsd: 3150,
    lastUpdated: "Actualizado ahora",
  },
  {
    id: "4",
    name: "Interactive Brokers Cash",
    institution: "Interactive Brokers",
    type: "broker",
    currency: "USD",
    balance: 1800,
    balanceUsd: 1800,
    lastUpdated: "Hoy, 07:50",
  },
  {
    id: "5",
    name: "Efectivo físico",
    institution: "Efectivo",
    type: "physical",
    currency: "ARS",
    balance: 320,
    balanceUsd: 0.22,
    lastUpdated: "Ayer, 18:30",
  },
];

export const assets = [
  {
    id: "btc",
    name: "Bitcoin",
    ticker: "BTC",
    type: "CRYPTO",
    quantity: 0.85,
    costBasis: 44350,
    currentValue: 52400,
    pnlPercent: 18.2,
    currency: "USD",
  },
  {
    id: "aapl",
    name: "Apple",
    ticker: "AAPL",
    type: "STOCK",
    quantity: 45,
    costBasis: 7650,
    currentValue: 8200,
    pnlPercent: 7.2,
    currency: "USD",
  },
  {
    id: "al30",
    name: "Bono AL30",
    ticker: "AL30",
    type: "BOND",
    quantity: 1,
    costBasis: 4800,
    currentValue: 5125,
    pnlPercent: 6.8,
    currency: "USD",
  },
  {
    id: "apto-caba",
    name: "Apartment CABA - Palermo",
    ticker: null,
    type: "REAL_ESTATE",
    quantity: 1,
    costBasis: 28500,
    currentValue: 35000,
    pnlPercent: 22.8,
    currency: "USD",
  },
];

export const recentTransactions = [
  {
    id: "t1",
    date: "2026-08-18",
    description: "Bitcoin Purchase",
    category: "Crypto",
    amount: -1250,
    type: "BUY",
    status: "COMPLETED",
  },
  {
    id: "t2",
    date: "2026-08-17",
    description: "AAPL Dividend",
    category: "Stocks",
    amount: 145.3,
    type: "DIVIDEND",
    status: "COMPLETED",
  },
  {
    id: "t3",
    date: "2026-08-15",
    description: "Rental Income – Palermo",
    category: "Real Estate",
    amount: 1200,
    type: "RENT",
    status: "COMPLETED",
  },
  {
    id: "t4",
    date: "2026-08-14",
    description: "Transfer to Savings",
    category: "Cash",
    amount: -500,
    type: "TRANSFER",
    status: "COMPLETED",
  },
  {
    id: "t5",
    date: "2026-08-12",
    description: "Cupón AL30",
    category: "Bonds",
    amount: 275,
    type: "COUPON",
    status: "COMPLETED",
  },
];

export const cashflowSummary = {
  income: 4200,
  expenses: 2850,
  net: 1350,
  incomeChange: 12,
  expensesChange: 8,
  netChange: 28,
};

export const expenseCategories = [
  { name: "Housing", value: 1450, percent: 50.9, color: "#8b5cf6" },
  { name: "Food", value: 620, percent: 21.8, color: "#f97316" },
  { name: "Transport", value: 410, percent: 14.4, color: "#3b82f6" },
  { name: "Subscriptions", value: 370, percent: 13.0, color: "#14b8a6" },
];
