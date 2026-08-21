import { toUsd } from "@/lib/utils";
import type {
  Account,
  AllocTarget,
  Asset,
  Fx,
  Portfolio,
  RecurringIncome,
  Snapshot,
  Tx,
} from "@/lib/types";
import { projectCashflow, type ProjectedEvent } from "@/lib/portfolio-math";

export function couponsByTicker(
  events: ProjectedEvent[],
  assets: Asset[],
  months = 24,
): { key: string; label: string; total: number; [ticker: string]: number | string }[] {
  const today = new Date();
  const nameById = new Map(assets.map((a) => [a.id, a.ticker || a.name.slice(0, 8)]));
  const buckets: { key: string; label: string; total: number; by: Record<string, number> }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1));
    const key = d.toISOString().slice(0, 7);
    buckets.push({ key, label: key.slice(5) + "/" + key.slice(2, 4), total: 0, by: {} });
  }
  for (const e of events) {
    if (e.kind !== "COUPON") continue;
    const b = buckets.find((x) => x.key === e.date.slice(0, 7));
    if (!b) continue;
    const t = nameById.get(e.assetId) || e.name.slice(0, 8);
    b.by[t] = (b.by[t] || 0) + e.amountUsd;
    b.total += e.amountUsd;
  }
  return buckets.map((b) => ({ key: b.key, label: b.label, total: b.total, ...b.by }));
}

export function couponTickers(rows: ReturnType<typeof couponsByTicker>): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (k !== "key" && k !== "label" && k !== "total") set.add(k);
    }
  }
  return [...set].sort();
}

export type CalendarCell = {
  key: string;
  label: string;
  coupon: number;
  amort: number;
  rent: number;
  other: number;
  total: number;
};

export function paymentCalendar(events: ProjectedEvent[], months = 24): CalendarCell[] {
  const today = new Date();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1));
    const key = d.toISOString().slice(0, 7);
    cells.push({ key, label: key.slice(5) + "/" + key.slice(2, 4), coupon: 0, amort: 0, rent: 0, other: 0, total: 0 });
  }
  for (const e of events) {
    const c = cells.find((x) => x.key === e.date.slice(0, 7));
    if (!c) continue;
    if (e.kind === "COUPON") c.coupon += e.amountUsd;
    else if (e.kind === "AMORT") c.amort += e.amountUsd;
    else if (e.kind === "RENT") c.rent += e.amountUsd;
    else c.other += e.amountUsd;
    c.total += e.amountUsd;
  }
  return cells;
}

export type BondYieldRow = {
  id: string;
  name: string;
  ticker: string | null;
  valueUsd: number;
  annualCoupon: number;
  yieldPct: number;
  nextCoupon: string | null;
};

export function bondYields(
  assets: Asset[],
  recurring: RecurringIncome[],
  events: ProjectedEvent[],
  fxAvg: number,
): BondYieldRow[] {
  return assets
    .filter((a) => a.type === "BOND")
    .map((a) => {
      const valueUsd = toUsd(a.currentValue, a.currency, fxAvg);
      const recs = recurring.filter((r) => r.assetId === a.id);
      let annual = 0;
      for (const r of recs) {
        const amt = toUsd(r.amount, r.currency, fxAvg);
        const f = r.frequency;
        if (f === "MONTHLY") annual += amt * 12;
        else if (f === "QUARTERLY") annual += amt * 4;
        else if (f === "SEMI_ANNUAL") annual += amt * 2;
        else if (f === "ANNUAL") annual += amt;
        else if (f === "WEEKLY") annual += amt * 52;
        else annual += amt * 2;
      }
      if (annual === 0) {
        annual = events
          .filter((e) => e.assetId === a.id && e.kind === "COUPON")
          .reduce((s, e) => s + e.amountUsd, 0);
      }
      const next = events.find((e) => e.assetId === a.id && e.kind === "COUPON");
      return {
        id: a.id,
        name: a.name,
        ticker: a.ticker,
        valueUsd,
        annualCoupon: annual,
        yieldPct: valueUsd > 0 ? (annual / valueUsd) * 100 : 0,
        nextCoupon: next?.date ?? null,
      };
    })
    .sort((a, b) => b.yieldPct - a.yieldPct);
}

export function upcomingAmort(events: ProjectedEvent[], limit = 20) {
  return events.filter((e) => e.kind === "AMORT").slice(0, limit);
}

export function incomeExpenseSeries(transactions: Tx[], fxAvg: number, months = 12) {
  const today = new Date();
  const buckets: { key: string; label: string; income: number; expense: number; net: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    buckets.push({ key, label: key.slice(5) + "/" + key.slice(2, 4), income: 0, expense: 0, net: 0 });
  }
  for (const t of transactions) {
    const b = buckets.find((x) => x.key === t.date.slice(0, 7));
    if (!b) continue;
    const v = toUsd(t.amount, t.currency, fxAvg);
    if (v >= 0) b.income += v;
    else b.expense += Math.abs(v);
  }
  for (const b of buckets) b.net = b.income - b.expense;
  return buckets;
}

export function allocVsTarget(
  assets: Asset[],
  accounts: Account[],
  targets: AllocTarget[],
  fxAvg: number,
) {
  const cashUsd = accounts.reduce((s, a) => s + toUsd(a.balance, a.currency, fxAvg), 0);
  const map = new Map<string, number>();
  map.set("CASH", cashUsd);
  for (const a of assets) {
    map.set(a.type, (map.get(a.type) || 0) + toUsd(a.currentValue, a.currency, fxAvg));
  }
  const total = [...map.values()].reduce((s, v) => s + v, 0) || 1;
  return ["CRYPTO", "STOCK", "BOND", "REAL_ESTATE", "CASH", "OTHER"]
    .map((type) => {
      const value = map.get(type) || 0;
      const actualPct = (value / total) * 100;
      const targetPct = targets.find((t) => t.assetType === type)?.targetPct ?? 0;
      return { type, value, actualPct, targetPct, gap: actualPct - targetPct };
    })
    .filter((r) => r.value > 0 || r.targetPct > 0);
}

export function pnlContribution(assets: Asset[], fxAvg: number) {
  const rows = assets.map((a) => {
    const value = toUsd(a.currentValue, a.currency, fxAvg);
    const cost = toUsd(a.costBasis, a.currency, fxAvg);
    return {
      id: a.id,
      name: a.name,
      ticker: a.ticker,
      type: a.type,
      pnl: value - cost,
      pnlPct: cost ? ((value - cost) / cost) * 100 : 0,
      value,
    };
  });
  const totalPnl = rows.reduce((s, r) => s + r.pnl, 0);
  return rows
    .map((r) => ({
      ...r,
      contribPct: totalPnl !== 0 ? (r.pnl / Math.abs(totalPnl)) * 100 : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

export function currencyBreakdown(assets: Asset[], accounts: Account[], fxAvg: number) {
  const map = new Map<string, number>();
  const add = (c: string, amt: number) => {
    const code = (c || "USD").toUpperCase();
    map.set(code, (map.get(code) || 0) + toUsd(amt, code, fxAvg));
  };
  for (const a of assets) add(a.currency, a.currentValue);
  for (const a of accounts) add(a.currency, a.balance);
  const total = [...map.values()].reduce((s, v) => s + v, 0) || 1;
  return [...map.entries()]
    .map(([code, valueUsd]) => ({ code, valueUsd, weight: (valueUsd / total) * 100 }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

export function nwDrawdown(snapshots: Snapshot[], currentNw: number) {
  const series = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (series.length === 0) {
    return {
      peak: currentNw,
      drawdown: 0,
      drawdownPct: 0,
      series: [] as { date: string; nw: number; peak: number; dd: number }[],
    };
  }
  let peak = series[0].totalUsd;
  const out: { date: string; nw: number; peak: number; dd: number }[] = [];
  for (const s of series) {
    peak = Math.max(peak, s.totalUsd);
    const dd = peak > 0 ? ((s.totalUsd - peak) / peak) * 100 : 0;
    out.push({ date: s.date, nw: s.totalUsd, peak, dd });
  }
  peak = Math.max(peak, currentNw);
  const drawdown = currentNw - peak;
  const drawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0;
  return { peak, drawdown, drawdownPct, series: out };
}

export function concentrationStats(assets: Asset[], accounts: Account[], fxAvg: number) {
  const rows: { name: string; value: number }[] = [];
  for (const a of assets) {
    rows.push({ name: a.ticker || a.name, value: toUsd(a.currentValue, a.currency, fxAvg) });
  }
  for (const a of accounts) {
    rows.push({ name: a.name, value: toUsd(a.balance, a.currency, fxAvg) });
  }
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const weights = rows.map((r) => r.value / total).sort((a, b) => b - a);
  const hhi = weights.reduce((s, w) => s + w * w, 0) * 10000;
  const top5 = weights.slice(0, 5).reduce((s, w) => s + w, 0) * 100;
  const top1 = (weights[0] || 0) * 100;
  return { hhi, top5, top1, n: rows.length };
}

export function classCorrelationProxy(assets: Asset[]) {
  const types = [...new Set(assets.map((a) => a.type))];
  if (types.length === 0) types.push("CASH");
  const liquid = new Set(["CRYPTO", "STOCK", "BOND", "CASH"]);
  const matrix: { a: string; b: string; corr: number }[] = [];
  for (let i = 0; i < types.length; i++) {
    for (let j = i; j < types.length; j++) {
      const a = types[i];
      const b = types[j];
      let corr = a === b ? 1 : 0.15;
      if (a !== b && liquid.has(a) && liquid.has(b)) corr = 0.45;
      if ((a === "CRYPTO" && b === "STOCK") || (a === "STOCK" && b === "CRYPTO")) corr = 0.55;
      if (a === "REAL_ESTATE" || b === "REAL_ESTATE") corr = a === b ? 1 : 0.1;
      matrix.push({ a, b, corr });
    }
  }
  return { types, matrix };
}

export function fxScenario(assets: Asset[], accounts: Account[], fx: Fx) {
  const shock = 0.1;
  const baseAvg = fx.average || 1;
  const scenarios = [
    { name: "BASE", blue: fx.blue, avg: baseAvg },
    {
      name: "BLUE +10%",
      blue: fx.blue * (1 + shock),
      avg: (fx.official + fx.blue * (1 + shock) + fx.mep) / 3,
    },
    {
      name: "BLUE -10%",
      blue: fx.blue * (1 - shock),
      avg: (fx.official + fx.blue * (1 - shock) + fx.mep) / 3,
    },
  ];
  return scenarios.map((sc) => {
    let nw = 0;
    for (const a of assets) {
      nw += a.currency === "ARS" ? a.currentValue / sc.avg : toUsd(a.currentValue, a.currency, sc.avg);
    }
    for (const a of accounts) {
      nw += a.currency === "ARS" ? a.balance / sc.avg : toUsd(a.balance, a.currency, sc.avg);
    }
    return { ...sc, nw };
  });
}

export function rebalanceSuggestions(
  assets: Asset[],
  accounts: Account[],
  targets: AllocTarget[],
  fxAvg: number,
) {
  const rows = allocVsTarget(assets, accounts, targets, fxAvg);
  const total =
    assets.reduce((s, a) => s + toUsd(a.currentValue, a.currency, fxAvg), 0) +
    accounts.reduce((s, a) => s + toUsd(a.balance, a.currency, fxAvg), 0);
  return rows
    .filter((r) => r.targetPct > 0 && Math.abs(r.gap) >= 2)
    .map((r) => ({
      type: r.type,
      gapPct: r.gap,
      action: r.gap > 0 ? "REDUCIR" : "AUMENTAR",
      usd: Math.abs((r.gap / 100) * total),
      actualPct: r.actualPct,
      targetPct: r.targetPct,
    }))
    .sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct));
}

export function costBasisLadder(assets: Asset[], fxAvg: number) {
  return assets
    .map((a) => {
      const value = toUsd(a.currentValue, a.currency, fxAvg);
      const cost = toUsd(a.costBasis, a.currency, fxAvg);
      return {
        id: a.id,
        name: a.name,
        ticker: a.ticker,
        type: a.type,
        cost,
        value,
        unrealized: value - cost,
        multiple: cost > 0 ? value / cost : 0,
        purchaseDate: a.purchaseDate,
      };
    })
    .sort((a, b) => a.cost - b.cost);
}

export function computeAnalytics(p: Portfolio) {
  const projected = projectCashflow(p.recurring, p.transactions, p.fx.average, 36);
  const couponRows = couponsByTicker(projected, p.assets, 24);
  const tickers = couponTickers(couponRows);
  const calendar = paymentCalendar(projected, 24);
  const yields = bondYields(p.assets, p.recurring, projected, p.fx.average);
  const amorts = upcomingAmort(projected, 15);
  const ieSeries = incomeExpenseSeries(p.transactions, p.fx.average, 12);
  const allocTarget = allocVsTarget(p.assets, p.accounts, p.allocTargets || [], p.fx.average);
  const pnlContrib = pnlContribution(p.assets, p.fx.average);
  const fxBreak = currencyBreakdown(p.assets, p.accounts, p.fx.average);
  const currentNw =
    p.assets.reduce((s, a) => s + toUsd(a.currentValue, a.currency, p.fx.average), 0) +
    p.accounts.reduce((s, a) => s + toUsd(a.balance, a.currency, p.fx.average), 0);
  const dd = nwDrawdown(p.snapshots, currentNw);
  const conc = concentrationStats(p.assets, p.accounts, p.fx.average);
  const corr = classCorrelationProxy(p.assets);
  const fxScen = fxScenario(p.assets, p.accounts, p.fx);
  const rebal = rebalanceSuggestions(p.assets, p.accounts, p.allocTargets || [], p.fx.average);
  const ladder = costBasisLadder(p.assets, p.fx.average);

  return {
    projected,
    couponRows,
    tickers,
    calendar,
    yields,
    amorts,
    ieSeries,
    allocTarget,
    pnlContrib,
    fxBreak,
    dd,
    conc,
    corr,
    fxScen,
    rebal,
    ladder,
    currentNw,
  };
}

export type Analytics = ReturnType<typeof computeAnalytics>;
