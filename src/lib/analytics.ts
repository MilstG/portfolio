import { toUsd } from "@/lib/utils";
import type {
  Account,
  AllocTarget,
  Asset,
  Fx,
  Goal,
  Portfolio,
  Snapshot,
  Tx,
} from "@/lib/types";
import {
  type ProjectedEvent,
  projectCashflow,
  rankedHoldings,
  netWorthUsd,
  allocationBuckets,
} from "@/lib/portfolio-math";

/** Coupons grouped by ticker over projected events. */
export function couponsByTicker(events: ProjectedEvent[], limit = 24) {
  const map = new Map<string, { name: string; total: number; count: number; next: string }>();
  for (const e of events) {
    if (e.kind !== "COUPON") continue;
    const key = e.assetId || e.name;
    const cur = map.get(key) || { name: e.name, total: 0, count: 0, next: e.date };
    cur.total += e.amountUsd;
    cur.count += 1;
    if (e.date < cur.next) cur.next = e.date;
    map.set(key, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function upcomingAmort(events: ProjectedEvent[], limit = 20) {
  return events.filter((e) => e.kind === "AMORT").slice(0, limit);
}

export function paymentCalendar(events: ProjectedEvent[], months = 24) {
  const today = new Date();
  const cells: { key: string; label: string; total: number; count: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1));
    const key = d.toISOString().slice(0, 7);
    cells.push({ key, label: key.slice(5) + "/" + key.slice(2, 4), total: 0, count: 0 });
  }
  for (const e of events) {
    const key = e.date.slice(0, 7);
    const c = cells.find((x) => x.key === key);
    if (c) {
      c.total += e.amountUsd;
      c.count += 1;
    }
  }
  return cells;
}

export function bondYields(assets: Asset[], events: ProjectedEvent[], fxAvg: number) {
  const bonds = assets.filter((a) => a.type === "BOND");
  return bonds
    .map((b) => {
      const value = toUsd(b.currentValue, b.currency, fxAvg);
      const yearly = events
        .filter((e) => e.assetId === b.id && (e.kind === "COUPON" || e.kind === "OTHER"))
        .reduce((s, e) => s + e.amountUsd, 0);
      // events are 12m window → yearly ≈ sum
      const ytm = value > 0 ? (yearly / value) * 100 : 0;
      return {
        id: b.id,
        name: b.ticker || b.name,
        value,
        yearlyIncome: yearly,
        yieldPct: ytm,
      };
    })
    .sort((a, b) => b.yieldPct - a.yieldPct);
}

export function incomeExpenseSeries(transactions: Tx[], fxAvg: number, months = 12) {
  const today = new Date();
  const buckets: { key: string; label: string; income: number; expense: number; net: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    buckets.push({
      key,
      label: key.slice(5) + "/" + key.slice(2, 4),
      income: 0,
      expense: 0,
      net: 0,
    });
  }
  for (const t of transactions) {
    const key = t.date.slice(0, 7);
    const b = buckets.find((x) => x.key === key);
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
  const { alloc, total } = allocationBuckets(assets, accounts, fxAvg);
  const byKey = new Map(alloc.map((a) => [a.key, a.value]));
  const rows = targets.map((t) => {
    const actual = byKey.get(t.assetType) || 0;
    const actualPct = total > 0 ? (actual / total) * 100 : 0;
    return {
      type: t.assetType,
      targetPct: t.targetPct,
      actualPct,
      gap: actualPct - t.targetPct,
      actualUsd: actual,
    };
  });
  // include classes with value but no target
  for (const a of alloc) {
    if (!rows.some((r) => r.type === a.key)) {
      rows.push({
        type: a.key,
        targetPct: 0,
        actualPct: total > 0 ? (a.value / total) * 100 : 0,
        gap: total > 0 ? (a.value / total) * 100 : 0,
        actualUsd: a.value,
      });
    }
  }
  return rows.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
}

export function pnlContribution(assets: Asset[], fxAvg: number) {
  return assets
    .map((a) => {
      const value = toUsd(a.currentValue, a.currency, fxAvg);
      const cost = toUsd(a.costBasis, a.currency, fxAvg);
      const pnl = value - cost;
      return {
        id: a.id,
        name: a.ticker || a.name,
        type: a.type,
        pnl,
        pnlPct: cost ? (pnl / cost) * 100 : 0,
        value,
      };
    })
    .sort((a, b) => b.pnl - a.pnl);
}

export function currencyBreakdown(assets: Asset[], accounts: Account[], fxAvg: number) {
  const map = new Map<string, number>();
  const add = (c: string, n: number) => {
    const code = (c || "USD").toUpperCase();
    map.set(code, (map.get(code) || 0) + toUsd(n, code, fxAvg));
  };
  for (const a of assets) add(a.currency, a.currentValue);
  for (const a of accounts) add(a.currency, a.balance);
  const total = [...map.values()].reduce((s, v) => s + v, 0) || 1;
  return [...map.entries()]
    .map(([code, valueUsd]) => ({ code, valueUsd, weight: (valueUsd / total) * 100 }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

export function nwDrawdown(snapshots: Snapshot[], currentNw: number) {
  const pts = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length === 0) {
    return { peak: currentNw, trough: currentNw, drawdownPct: 0, series: [] as { date: string; value: number; dd: number }[] };
  }
  let peak = pts[0].totalUsd;
  const series: { date: string; value: number; dd: number }[] = [];
  let maxDd = 0;
  let trough = peak;
  for (const p of pts) {
    if (p.totalUsd > peak) peak = p.totalUsd;
    const dd = peak > 0 ? ((p.totalUsd - peak) / peak) * 100 : 0;
    if (dd < maxDd) {
      maxDd = dd;
      trough = p.totalUsd;
    }
    series.push({ date: p.date, value: p.totalUsd, dd });
  }
  // live point
  if (currentNw > peak) peak = currentNw;
  const liveDd = peak > 0 ? ((currentNw - peak) / peak) * 100 : 0;
  if (liveDd < maxDd) maxDd = liveDd;
  return { peak, trough, drawdownPct: maxDd, series };
}

/** Herfindahl-Hirschman Index of holdings (0–10000). */
export function concentrationStats(assets: Asset[], accounts: Account[], fxAvg: number) {
  const nw = netWorthUsd({ assets, accounts, fx: { official: fxAvg, blue: fxAvg, mep: fxAvg, average: fxAvg } });
  const holdings = rankedHoldings(assets, accounts, fxAvg, nw);
  const hhi = holdings.reduce((s, h) => s + h.weight * h.weight, 0);
  return {
    hhi,
    top3: holdings.slice(0, 3).reduce((s, h) => s + h.weight, 0),
    top5: holdings.slice(0, 5).reduce((s, h) => s + h.weight, 0),
    count: holdings.length,
    holdings: holdings.slice(0, 10),
  };
}

/** Simple class weight correlation proxy (overlap matrix not true corr). */
export function classCorrelationProxy(assets: Asset[]) {
  const types = [...new Set(assets.map((a) => a.type))];
  return types.map((t) => ({
    type: t,
    count: assets.filter((a) => a.type === t).length,
  }));
}

/** FX stress: revalue book if ARS FX moves ±% on average. */
export function fxScenario(assets: Asset[], accounts: Account[], fx: Fx) {
  const base = netWorthUsd({ assets, accounts, fx });
  const scenarios = [-30, -15, -5, 0, 5, 15, 30].map((pct) => {
    const mult = 1 + pct / 100;
    // Only ARS balances scale with FX; USD stays
    let total = 0;
    for (const a of assets) {
      if ((a.currency || "").toUpperCase() === "ARS") {
        total += toUsd(a.currentValue, "ARS", fx.average) * mult;
      } else {
        total += toUsd(a.currentValue, a.currency, fx.average);
      }
    }
    for (const a of accounts) {
      if ((a.currency || "").toUpperCase() === "ARS") {
        total += toUsd(a.balance, "ARS", fx.average) * mult;
      } else {
        total += toUsd(a.balance, a.currency, fx.average);
      }
    }
    return { pct, nw: total, delta: total - base };
  });
  return { base, scenarios };
}

export function rebalanceSuggestions(
  assets: Asset[],
  accounts: Account[],
  targets: AllocTarget[],
  fxAvg: number,
) {
  const rows = allocVsTarget(assets, accounts, targets, fxAvg);
  return rows
    .filter((r) => Math.abs(r.gap) >= 2)
    .map((r) => ({
      type: r.type,
      action: r.gap > 0 ? "REDUCIR" : "AUMENTAR",
      gapPct: r.gap,
      actualPct: r.actualPct,
      targetPct: r.targetPct,
    }));
}

export function costBasisLadder(assets: Asset[], fxAvg: number) {
  return assets
    .map((a) => {
      const value = toUsd(a.currentValue, a.currency, fxAvg);
      const cost = toUsd(a.costBasis, a.currency, fxAvg);
      return {
        id: a.id,
        name: a.ticker || a.name,
        cost,
        value,
        ratio: cost > 0 ? value / cost : 0,
        pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
      };
    })
    .sort((a, b) => a.ratio - b.ratio);
}

export function goalsProgress(goals: Goal[], nw: number) {
  return goals.map((g) => ({
    id: g.id,
    name: g.name,
    targetUsd: g.targetUsd,
    targetDate: g.targetDate,
    progressPct: g.targetUsd > 0 ? Math.min(100, (nw / g.targetUsd) * 100) : 0,
    remaining: Math.max(0, g.targetUsd - nw),
  }));
}

export function computeAnalytics(p: Portfolio) {
  const fxAvg = p.fx.average;
  const nw = netWorthUsd(p);
  const events = projectCashflow(p.recurring, p.transactions, fxAvg, 24);
  const events12 = events.filter((e) => {
    const end = new Date();
    end.setMonth(end.getMonth() + 12);
    return e.date <= end.toISOString().slice(0, 10);
  });

  return {
    coupons: couponsByTicker(events12),
    amorts: upcomingAmort(events, 20),
    calendar: paymentCalendar(events, 24),
    bondYields: bondYields(p.assets, events12, fxAvg),
    incomeExpense: incomeExpenseSeries(p.transactions, fxAvg, 12),
    allocTarget: allocVsTarget(p.assets, p.accounts, p.allocTargets, fxAvg),
    pnlContrib: pnlContribution(p.assets, fxAvg),
    fxExposure: currencyBreakdown(p.assets, p.accounts, fxAvg),
    drawdown: nwDrawdown(p.snapshots, nw),
    concentration: concentrationStats(p.assets, p.accounts, fxAvg),
    classes: classCorrelationProxy(p.assets),
    fxScenario: fxScenario(p.assets, p.accounts, p.fx),
    rebalance: rebalanceSuggestions(p.assets, p.accounts, p.allocTargets, fxAvg),
    costLadder: costBasisLadder(p.assets, fxAvg),
    goals: goalsProgress(p.goals, nw),
    events12,
  };
}

export type Analytics = ReturnType<typeof computeAnalytics>;
