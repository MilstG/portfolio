import { annualFactor, toUsd,
  monthLabel,
} from "@/lib/utils";
import type {
  Account,
  Asset,
  Portfolio,
  RecurringIncome,
  Snapshot,
  Tx,
} from "@/lib/types";

export function netWorthUsd(p: {
  assets: Pick<Asset, "currentValue" | "currency">[];
  accounts: Pick<Account, "balance" | "currency">[];
  fx: { average: number };
  liabilities?: { balance: number; currency: string }[];
}) {
  const assets = p.assets.reduce(
    (s, a) => s + toUsd(a.currentValue, a.currency, p.fx.average),
    0,
  );
  const cash = p.accounts.reduce(
    (s, a) => s + toUsd(a.balance, a.currency, p.fx.average),
    0,
  );
  const debt = (p.liabilities || []).reduce(
    (s, l) => s + toUsd(l.balance, l.currency, p.fx.average),
    0,
  );
  return assets + cash - debt;
}

export function monthlyRecurringUsd(items: RecurringIncome[], fxAvg: number) {
  return items.reduce((s, r) => {
    const yearly =
      toUsd(r.amount, r.currency, fxAvg) * annualFactor(r.frequency);
    return s + yearly / 12;
  }, 0);
}

export function realEstateYield(
  assets: Asset[],
  rec: RecurringIncome[],
  fxAvg: number,
) {
  const re = assets.filter((a) => a.type === "REAL_ESTATE");
  const value = re.reduce(
    (s, a) => s + toUsd(a.currentValue, a.currency, fxAvg),
    0,
  );
  if (value <= 0) return 0;
  const ids = new Set(re.map((a) => a.id));
  const yearly = rec
    .filter((r) => ids.has(r.assetId))
    .reduce(
      (s, r) =>
        s + toUsd(r.amount, r.currency, fxAvg) * annualFactor(r.frequency),
      0,
    );
  return (yearly / value) * 100;
}

export function incomeYield(monthlyUsd: number, netWorth: number) {
  if (netWorth <= 0) return 0;
  return ((monthlyUsd * 12) / netWorth) * 100;
}

export type HoldingRow = {
  id: string;
  name: string;
  ticker: string | null;
  type: string;
  valueUsd: number;
  costUsd: number;
  pnlUsd: number;
  pnlPct: number;
  weight: number;
};

export function rankedHoldings(
  assets: Asset[],
  accounts: Account[],
  fxAvg: number,
  netWorth: number,
): HoldingRow[] {
  const rows: HoldingRow[] = assets.map((a) => {
    const valueUsd = toUsd(a.currentValue, a.currency, fxAvg);
    const costUsd = toUsd(a.costBasis, a.currency, fxAvg);
    const pnlUsd = valueUsd - costUsd;
    return {
      id: a.id,
      name: a.name,
      ticker: a.ticker,
      type: a.type,
      valueUsd,
      costUsd,
      pnlUsd,
      pnlPct: costUsd ? (pnlUsd / costUsd) * 100 : 0,
      weight: netWorth > 0 ? (valueUsd / netWorth) * 100 : 0,
    };
  });
  for (const a of accounts) {
    const valueUsd = toUsd(a.balance, a.currency, fxAvg);
    rows.push({
      id: a.id,
      name: a.name,
      ticker: a.institution,
      type: "CASH",
      valueUsd,
      costUsd: valueUsd,
      pnlUsd: 0,
      pnlPct: 0,
      weight: netWorth > 0 ? (valueUsd / netWorth) * 100 : 0,
    });
  }
  return rows.sort((a, b) => b.valueUsd - a.valueUsd);
}

export function concentration(holdings: HoldingRow[]) {
  return holdings[0]?.weight ?? 0;
}

export function currencyExposure(
  assets: Asset[],
  accounts: Account[],
  fxAvg: number,
): { code: string; valueUsd: number; weight: number }[] {
  const map = new Map<string, number>();
  const add = (currency: string, amount: number) => {
    const code = (currency || "USD").toUpperCase();
    const usd = toUsd(amount, code, fxAvg);
    map.set(code, (map.get(code) || 0) + usd);
  };
  for (const a of assets) add(a.currency, a.currentValue);
  for (const a of accounts) add(a.currency, a.balance);
  const total = [...map.values()].reduce((s, v) => s + v, 0) || 1;
  return [...map.entries()]
    .map(([code, valueUsd]) => ({
      code,
      valueUsd,
      weight: (valueUsd / total) * 100,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

export function liquiditySplit(
  assets: Asset[],
  accounts: Account[],
  fxAvg: number,
) {
  const cash = accounts.reduce(
    (s, a) => s + toUsd(a.balance, a.currency, fxAvg),
    0,
  );
  let liquid = cash;
  let illiquid = 0;
  for (const a of assets) {
    const v = toUsd(a.currentValue, a.currency, fxAvg);
    if (a.type === "REAL_ESTATE") illiquid += v;
    else liquid += v;
  }
  const total = liquid + illiquid || 1;
  return {
    liquid,
    illiquid,
    liquidPct: (liquid / total) * 100,
    illiquidPct: (illiquid / total) * 100,
  };
}

export function pnlByType(assets: Asset[], fxAvg: number) {
  const map = new Map<string, { value: number; cost: number }>();
  for (const a of assets) {
    const cur = map.get(a.type) || { value: 0, cost: 0 };
    cur.value += toUsd(a.currentValue, a.currency, fxAvg);
    cur.cost += toUsd(a.costBasis, a.currency, fxAvg);
    map.set(a.type, cur);
  }
  return [...map.entries()]
    .map(([type, v]) => ({
      type,
      value: v.value,
      cost: v.cost,
      pnl: v.value - v.cost,
      pnlPct: v.cost ? ((v.value - v.cost) / v.cost) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function allocationBuckets(
  assets: Asset[],
  accounts: Account[],
  fxAvg: number,
) {
  const cashUsd = accounts.reduce(
    (s, a) => s + toUsd(a.balance, a.currency, fxAvg),
    0,
  );
  const buckets = [
    { key: "CRYPTO", name: "CRYPTO", value: 0 },
    { key: "STOCK", name: "EQTY", value: 0 },
    { key: "BOND", name: "FI", value: 0 },
    { key: "REAL_ESTATE", name: "RE", value: 0 },
    { key: "CASH", name: "CASH", value: cashUsd },
    { key: "OTHER", name: "OTHER", value: 0 },
  ];
  for (const a of assets) {
    const b =
      buckets.find((x) => x.key === a.type) ||
      buckets.find((x) => x.key === "OTHER");
    if (b) b.value += toUsd(a.currentValue, a.currency, fxAvg);
  }
  const alloc = buckets.filter((b) => b.value > 0);
  const total = alloc.reduce((s, b) => s + b.value, 0) || 1;
  return { alloc, total };
}

export type IncomeKind = "COUPON" | "RENT" | "DIVIDEND" | "AMORT" | "OTHER";

export const INCOME_KIND_META: Record<
  IncomeKind,
  { label: string; color: string }
> = {
  // Categorical ramp (--color-cat-* in styles.css). These were the brand orange
  // and the P&L green, which made an income category look like an action or a
  // gain; a colour must mean one thing.
  COUPON: { label: "Cupón", color: "#4aa3ff" },
  RENT: { label: "Alquiler", color: "#2dd4bf" },
  DIVIDEND: { label: "Dividendo", color: "#a78bfa" },
  AMORT: { label: "Amortización", color: "#f472b6" },
  OTHER: { label: "Otros", color: "#94a3b8" },
};

export const INCOME_KINDS: IncomeKind[] = [
  "COUPON",
  "RENT",
  "DIVIDEND",
  "AMORT",
  "OTHER",
];

export type ProjectedEvent = {
  date: string;
  name: string;
  amountUsd: number;
  frequency: string;
  assetId: string;
  kind: IncomeKind;
};

/** Infer income kind from free-text name / tx type. */
export function inferIncomeKind(
  name: string,
  txType?: string | null,
): IncomeKind {
  const t = (txType || "").toUpperCase();
  if (t === "COUPON") return "COUPON";
  if (t === "RENT") return "RENT";
  if (t === "DIVIDEND") return "DIVIDEND";
  if (t === "AMORT") return "AMORT";
  // Legacy: principal repayments used to be imported as SELL.
  if (t === "SELL") return "AMORT";
  const n = (name || "").toLowerCase();
  if (/cup[oó]n|coupon|interes|interés/.test(n)) return "COUPON";
  if (/alquiler|rent|rental/.test(n)) return "RENT";
  if (/dividend|dividendo/.test(n)) return "DIVIDEND";
  if (/amort|principal|capital/.test(n)) return "AMORT";
  return "OTHER";
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function stepFrequency(iso: string, frequency: string): string {
  switch (frequency) {
    case "WEEKLY":
      return addDays(iso, 7);
    case "MONTHLY":
      return addMonths(iso, 1);
    case "QUARTERLY":
      return addMonths(iso, 3);
    case "SEMI_ANNUAL":
      return addMonths(iso, 6);
    case "ANNUAL":
      return addMonths(iso, 12);
    default:
      return addMonths(iso, 1);
  }
}

/** Project recurring income events over the next N months from today. */
export function projectRecurring(
  items: RecurringIncome[],
  fxAvg: number,
  months = 12,
): ProjectedEvent[] {
  const today = new Date().toISOString().slice(0, 10);
  const end = addMonths(today, months);
  const out: ProjectedEvent[] = [];
  for (const r of items) {
    let cursor = r.nextDate < today ? today : r.nextDate;
    let guard = 0;
    while (cursor < today && guard < 48) {
      cursor = stepFrequency(cursor, r.frequency);
      guard += 1;
    }
    guard = 0;
    while (cursor <= end && guard < 48) {
      out.push({
        date: cursor,
        name: r.name,
        amountUsd: toUsd(r.amount, r.currency, fxAvg),
        frequency: r.frequency,
        assetId: r.assetId,
        kind: inferIncomeKind(r.name),
      });
      cursor = stepFrequency(cursor, r.frequency);
      guard += 1;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const SCHEDULE_INCOME_TYPES = new Set([
  "COUPON",
  "RENT",
  "DIVIDEND",
  "INCOME",
  "AMORT",
  "SELL",
]);

/** Future-dated schedule rows (ON cupon/amort) as projection events. */
export function projectScheduledTxs(
  transactions: Tx[],
  fxAvg: number,
  months = 12,
): ProjectedEvent[] {
  const today = new Date().toISOString().slice(0, 10);
  const end = addMonths(today, months);
  const out: ProjectedEvent[] = [];
  for (const t of transactions) {
    if (t.date < today || t.date > end) continue;
    if (!SCHEDULE_INCOME_TYPES.has(t.type)) continue;
    const amountUsd = toUsd(t.amount, t.currency, fxAvg);
    if (amountUsd <= 0) continue;
    out.push({
      date: t.date,
      name: t.description,
      amountUsd,
      frequency: "SCHEDULED",
      assetId: t.assetId || "",
      kind: inferIncomeKind(t.description, t.type),
    });
  }
  return out;
}

/** Merge recurring + future schedule transactions for charts. */
export function projectCashflow(
  recurring: RecurringIncome[],
  transactions: Tx[],
  fxAvg: number,
  months = 12,
): ProjectedEvent[] {
  const fromRec = projectRecurring(recurring, fxAvg, months);
  const fromTx = projectScheduledTxs(transactions, fxAvg, months);
  // Same day + same asset + same amount is the same payment even when the
  // recurring rule and a pre-loaded ledger row spell the name differently
  // ("Cupon" vs "Cupón"). Without an asset, fall back to a normalized name.
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  const key = (e: ProjectedEvent) =>
    `${e.date}|${e.assetId ?? norm(e.name)}|${Math.round(e.amountUsd)}`;
  const map = new Map<string, ProjectedEvent>();
  for (const e of fromRec) map.set(key(e), e);
  for (const e of fromTx) map.set(key(e), e);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function incomeNextDays(events: ProjectedEvent[], days: number) {
  const today = new Date().toISOString().slice(0, 10);
  const end = addDays(today, days);
  return events
    .filter((e) => e.date >= today && e.date <= end)
    .reduce((s, e) => s + e.amountUsd, 0);
}

export function monthlyProjectionBuckets(
  events: ProjectedEvent[],
  months = 12,
) {
  const today = new Date();
  const buckets: { key: string; label: string; total: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1),
    );
    const key = d.toISOString().slice(0, 7);
    buckets.push({
      key,
      label: monthLabel(key),
      total: 0,
    });
  }
  for (const e of events) {
    const key = e.date.slice(0, 7);
    const b = buckets.find((x) => x.key === key);
    if (b) b.total += e.amountUsd;
  }
  return buckets;
}

export type MonthStackRow = {
  key: string;
  label: string;
  total: number;
  COUPON: number;
  RENT: number;
  DIVIDEND: number;
  AMORT: number;
  OTHER: number;
};

/** Monthly projection stacked by income kind (for colored bar charts). */
export function monthlyProjectionStacked(
  events: ProjectedEvent[],
  months = 12,
): MonthStackRow[] {
  const today = new Date();
  const buckets: MonthStackRow[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1),
    );
    const key = d.toISOString().slice(0, 7);
    buckets.push({
      key,
      label: monthLabel(key),
      total: 0,
      COUPON: 0,
      RENT: 0,
      DIVIDEND: 0,
      AMORT: 0,
      OTHER: 0,
    });
  }
  for (const e of events) {
    const key = e.date.slice(0, 7);
    const b = buckets.find((x) => x.key === key);
    if (!b) continue;
    const kind = e.kind || "OTHER";
    b[kind] += e.amountUsd;
    b.total += e.amountUsd;
  }
  return buckets;
}

/** Which kinds actually have non-zero totals (for legend). */
export function activeIncomeKinds(rows: MonthStackRow[]): IncomeKind[] {
  return INCOME_KINDS.filter((k) => rows.some((r) => r[k] > 0));
}

export function nwDelta(snapshots: Snapshot[], currentNw: number) {
  if (snapshots.length === 0)
    return { delta: 0, pct: 0, prior: null as number | null };
  const prior = snapshots[snapshots.length - 1]?.totalUsd ?? null;
  if (prior == null) return { delta: 0, pct: 0, prior: null };
  const today = new Date().toISOString().slice(0, 10);
  let base = prior;
  if (snapshots[snapshots.length - 1]?.date === today && snapshots.length > 1) {
    base = snapshots[snapshots.length - 2].totalUsd;
  }
  const delta = currentNw - base;
  const pct = base ? (delta / base) * 100 : 0;
  return { delta, pct, prior: base };
}

export function txTotals(transactions: Tx[], fxAvg: number) {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    const v = toUsd(t.amount, t.currency, fxAvg);
    if (v >= 0) income += v;
    else expense += v;
  }
  return { income, expense, net: income + expense };
}

export function categoryBreakdown(transactions: Tx[], fxAvg: number) {
  const map = new Map<string, number>();
  for (const t of transactions) {
    const v = toUsd(t.amount, t.currency, fxAvg);
    const key = (t.category || t.type || "OTHER").toUpperCase();
    map.set(key, (map.get(key) || 0) + v);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

export function monthlyTxSeries(transactions: Tx[], fxAvg: number, months = 6) {
  const today = new Date();
  const buckets: { key: string; label: string; in: number; out: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1),
    );
    const key = d.toISOString().slice(0, 7);
    buckets.push({
      key,
      label: monthLabel(key),
      in: 0,
      out: 0,
    });
  }
  for (const t of transactions) {
    const key = t.date.slice(0, 7);
    const b = buckets.find((x) => x.key === key);
    if (!b) continue;
    const v = toUsd(t.amount, t.currency, fxAvg);
    if (v >= 0) b.in += v;
    else b.out += Math.abs(v);
  }
  return buckets;
}

export function buildInsights(input: {
  nw: number;
  monthly: number;
  yieldPct: number;
  concentration: number;
  liquidPct: number;
  cashPct: number;
  arsWeight: number;
  nwDeltaPct: number;
  reYield: number;
  next30: number;
  holdingsCount: number;
}): string[] {
  const lines: string[] = [];
  if (input.nwDeltaPct !== 0) {
    lines.push(
      input.nwDeltaPct >= 0
        ? `Patrimonio arriba ${Math.abs(input.nwDeltaPct).toFixed(1)}% vs snapshot previo.`
        : `Patrimonio abajo ${Math.abs(input.nwDeltaPct).toFixed(1)}% vs snapshot previo.`,
    );
  }
  if (input.yieldPct > 0) {
    lines.push(
      `Yield de ingresos ${input.yieldPct.toFixed(1)}% anual sobre el neto (${formatRough(input.monthly)}/mes).`,
    );
  } else {
    lines.push(
      "Sin ingresos recurrentes configurados — agregá alquileres o cupones en POS.",
    );
  }
  if (input.concentration >= 30) {
    lines.push(
      `Concentración alta: la mayor posición pesa ${input.concentration.toFixed(0)}% del libro.`,
    );
  } else if (input.holdingsCount > 0) {
    lines.push(
      `Libro diversificado: top posición al ${input.concentration.toFixed(0)}%.`,
    );
  }
  if (input.cashPct >= 25) {
    lines.push(
      `Cash elevado (${input.cashPct.toFixed(0)}% del neto) — idle capital o buffer intencional.`,
    );
  } else if (input.cashPct < 5 && input.nw > 0) {
    lines.push(
      `Cash bajo (${input.cashPct.toFixed(0)}%) — poca liquidez inmediata.`,
    );
  }
  if (input.liquidPct < 40) {
    lines.push(
      `Solo ${input.liquidPct.toFixed(0)}% líquido; el resto está en real estate u otros illíquidos.`,
    );
  }
  if (input.arsWeight >= 20) {
    lines.push(
      `Exposición ARS ${input.arsWeight.toFixed(0)}% del libro (convertido al FX promedio).`,
    );
  }
  if (input.reYield > 0) {
    lines.push(`Yield bruto real estate ${input.reYield.toFixed(1)}% anual.`);
  }
  if (input.next30 > 0) {
    lines.push(
      `Ingresos esperados próximos 30 días: ${formatRough(input.next30)}.`,
    );
  }
  return lines.slice(0, 6);
}

function formatRough(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function computeDashboard(p: Portfolio) {
  const nw = netWorthUsd(p);
  const cashUsd = p.accounts.reduce(
    (s, a) => s + toUsd(a.balance, a.currency, p.fx.average),
    0,
  );
  const costUsd = p.assets.reduce(
    (s, a) => s + toUsd(a.costBasis, a.currency, p.fx.average),
    0,
  );
  const assetsUsd = p.assets.reduce(
    (s, a) => s + toUsd(a.currentValue, a.currency, p.fx.average),
    0,
  );
  const pnl = assetsUsd - costUsd;
  const monthlyFromRecurring = monthlyRecurringUsd(p.recurring, p.fx.average);
  const projected = projectCashflow(
    p.recurring,
    p.transactions,
    p.fx.average,
    12,
  );
  const scheduled12m = projected.reduce((s, e) => s + e.amountUsd, 0);
  const monthly =
    scheduled12m / 12 > monthlyFromRecurring * 1.05
      ? scheduled12m / 12
      : monthlyFromRecurring;
  const yieldPct = incomeYield(monthly, nw);
  const reYield = realEstateYield(p.assets, p.recurring, p.fx.average);
  const holdings = rankedHoldings(p.assets, p.accounts, p.fx.average, nw);
  const topWeight = concentration(holdings);
  const currencies = currencyExposure(p.assets, p.accounts, p.fx.average);
  const liq = liquiditySplit(p.assets, p.accounts, p.fx.average);
  const byType = pnlByType(p.assets, p.fx.average);
  const { alloc, total: allocTotal } = allocationBuckets(
    p.assets,
    p.accounts,
    p.fx.average,
  );
  const next30 = incomeNextDays(projected, 30);
  const next90 = incomeNextDays(projected, 90);
  const projMonths = monthlyProjectionBuckets(projected, 12);
  const projStacked = monthlyProjectionStacked(projected, 12);
  const projKinds = activeIncomeKinds(projStacked);
  const delta = nwDelta(p.snapshots, nw);
  const tx = txTotals(p.transactions, p.fx.average);
  const cashPct = nw > 0 ? (cashUsd / nw) * 100 : 0;
  const arsWeight = currencies.find((c) => c.code === "ARS")?.weight ?? 0;
  const insights = buildInsights({
    nw,
    monthly,
    yieldPct,
    concentration: topWeight,
    liquidPct: liq.liquidPct,
    cashPct,
    arsWeight,
    nwDeltaPct: delta.pct,
    reYield,
    next30,
    holdingsCount: holdings.length,
  });

  return {
    nw,
    cashUsd,
    costUsd,
    assetsUsd,
    pnl,
    monthly,
    annualIncome: monthly * 12,
    yieldPct,
    reYield,
    holdings,
    topWeight,
    currencies,
    liq,
    byType,
    alloc,
    allocTotal,
    projected,
    next30,
    next90,
    projMonths,
    projStacked,
    projKinds,
    delta,
    tx,
    cashPct,
    insights,
  };
}
