import {
  bucketsFor,
  daysBetween,
  periodFor,
  shiftPeriod,
  type Period,
  type PeriodKind,
} from "@/lib/report-period";
import {
  INCOME_KIND_META,
  INCOME_KINDS,
  inferIncomeKind,
  projectCashflow,
  type IncomeKind,
} from "@/lib/portfolio-math";
import { loanPaymentsFor } from "@/lib/loans";
import type {
  Asset,
  FxHistoryRow,
  PositionPerformanceData,
  Portfolio,
  Snapshot,
  Tx,
} from "@/lib/types";
import { toUsd } from "@/lib/utils";

/**
 * Period reports.
 *
 * Everything here is built from what was recorded — snapshots, the ledger and
 * the FX history — and nothing is back-filled. Where the record is missing at a
 * boundary the report says so rather than reaching for the nearest number and
 * presenting it as the opening balance, because "net worth rose 12% this week"
 * computed off a snapshot from three weeks ago is a sentence that is wrong in a
 * way the reader cannot see.
 */

/**
 * FX on a date, from the history.
 *
 * Historical peso amounts converted at today's dollar are simply a different
 * number: a coupon fee of ARS 2,090 in May 2025 was not worth what ARS 2,090 is
 * worth now. When the history has no row at or before the date there is nothing
 * better than the current average, and `usedFallback` says it happened so the
 * page can flag the figure instead of quietly rounding history.
 */
export function fxAsOf(
  history: FxHistoryRow[],
  date: string,
  fallback: number,
): { rate: number; fromHistory: boolean } {
  let found: FxHistoryRow | null = null;
  for (const r of history) {
    if (r.date > date) break;
    found = r;
  }
  if (found && found.average > 0)
    return { rate: found.average, fromHistory: true };
  return { rate: fallback, fromHistory: false };
}

/** Latest snapshot at or before `date`, with how stale it is. */
function snapshotAsOf(
  snapshots: Snapshot[],
  date: string,
): { value: number; date: string; staleDays: number } | null {
  let found: Snapshot | null = null;
  for (const s of snapshots) {
    if (s.date > date) break;
    found = s;
  }
  if (!found) return null;
  return {
    value: found.totalUsd,
    date: found.date,
    staleDays: daysBetween(found.date, date),
  };
}

export type TxClass = "INCOME" | "EXPENSE" | "BUY" | "TRANSFER";

/**
 * What a ledger row does to the book.
 *
 * A purchase is not a loss and a transfer between two of the holder's own
 * accounts is not income; folding either into "ingresos / egresos" is how a
 * cashflow summary ends up claiming a month of heavy losses that was really a
 * month of heavy buying.
 */
export function classifyTx(t: Tx): TxClass {
  const type = (t.type || "").toUpperCase();
  if (type === "TRANSFER") return "TRANSFER";
  if (type === "BUY") return "BUY";
  return t.amount >= 0 ? "INCOME" : "EXPENSE";
}

export type ReportTx = {
  tx: Tx;
  amountUsd: number;
  kind: IncomeKind;
  cls: TxClass;
  /** False when the USD figure had to use today's FX for a past peso amount. */
  fxFromHistory: boolean;
  /**
   * Dated after today. The ledger carries the whole coupon schedule, not only
   * what has been collected, so a period that has not finished holds rows for
   * money that has not arrived. They are shown, and they are not counted.
   */
  future: boolean;
};

export type KindTotal = {
  kind: IncomeKind;
  label: string;
  color: string;
  amountUsd: number;
  count: number;
};

export type AssetIncomeRow = {
  assetId: string | null;
  name: string;
  amountUsd: number;
  count: number;
  kinds: IncomeKind[];
};

export type BucketRow = {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
} & Partial<Record<IncomeKind, number>>;

export type NwPoint = { date: string; label: string; value: number };

export type PeriodTotals = {
  incomeUsd: number;
  expenseUsd: number;
  buysUsd: number;
  netFlowUsd: number;
  txCount: number;
};

export type PeriodReport = {
  period: Period;
  previous: Period;

  /* --- patrimonio ------------------------------------------------------- */
  /** Snapshot at the day before the period opened. Null when none exists. */
  nwOpen: number | null;
  nwOpenDate: string | null;
  nwOpenStaleDays: number;
  nwClose: number | null;
  nwCloseDate: string | null;
  nwCloseStaleDays: number;
  nwChange: number | null;
  nwChangePct: number | null;
  /** Snapshots inside the window, for the series. */
  nwSeries: NwPoint[];
  nwHigh: number | null;
  nwLow: number | null;
  /** Worst peak-to-trough inside the window, as a negative percentage. */
  drawdownPct: number | null;

  /* --- flujos ----------------------------------------------------------- */
  totals: PeriodTotals;
  prevTotals: PeriodTotals;
  incomeByKind: KindTotal[];
  incomeByAsset: AssetIncomeRow[];
  buckets: BucketRow[];
  rows: ReportTx[];
  topPayments: ReportTx[];
  feesUsd: number;
  /**
   * Change in net worth the ledger does not account for: revaluation, FX, and
   * anything bought or sold without a transaction being recorded. Null when
   * either boundary snapshot is missing — with no opening balance there is no
   * residual to compute, only a subtraction that would look like one.
   */
  residualUsd: number | null;

  /* --- deuda ------------------------------------------------------------ */
  debtPaidUsd: number;
  debtPaymentCount: number;

  /* --- fx --------------------------------------------------------------- */
  fxOpen: FxHistoryRow | null;
  fxClose: FxHistoryRow | null;
  blueChangePct: number | null;
  mepChangePct: number | null;

  /* --- lo que viene ----------------------------------------------------- */
  /** Income already scheduled for the next period of the same length. */
  projectedNextUsd: number;
  projectedNextCount: number;
  /**
   * Income still to come inside *this* period — the calendar rows dated after
   * today. Reported apart from what was collected, never added to it.
   */
  pendingUsd: number;
  pendingCount: number;

  /* --- calidad del dato -------------------------------------------------- */
  /** Rows whose USD value had to be converted at today's FX. */
  fxFallbackCount: number;
  /** True when the period has not finished yet. */
  partial: boolean;
  /** Days of the period already elapsed, capped at its length. */
  elapsedDays: number;
};

function emptyTotals(): PeriodTotals {
  return {
    incomeUsd: 0,
    expenseUsd: 0,
    buysUsd: 0,
    netFlowUsd: 0,
    txCount: 0,
  };
}

function buildRows(
  transactions: Tx[],
  from: string,
  to: string,
  fxHistory: FxHistoryRow[],
  fxAvg: number,
  today: string,
): ReportTx[] {
  return transactions
    .filter((t) => t.date >= from && t.date <= to)
    .map((t) => {
      const { rate, fromHistory } = fxAsOf(fxHistory, t.date, fxAvg);
      return {
        tx: t,
        amountUsd: toUsd(t.amount, t.currency, rate),
        kind: inferIncomeKind(t.description, t.type),
        cls: classifyTx(t),
        // A USD amount never needed converting, so it is never a fallback.
        fxFromHistory:
          (t.currency || "USD").toUpperCase() === "ARS" ? fromHistory : true,
        future: t.date > today,
      };
    })
    .sort((a, b) => a.tx.date.localeCompare(b.tx.date));
}

/** What actually happened: everything dated today or earlier. */
function realised(rows: ReportTx[]): ReportTx[] {
  return rows.filter((r) => !r.future);
}

function totalsOf(rows: ReportTx[]): PeriodTotals {
  const t = emptyTotals();
  for (const r of rows) {
    t.txCount += 1;
    if (r.cls === "INCOME") t.incomeUsd += r.amountUsd;
    else if (r.cls === "EXPENSE") t.expenseUsd += Math.abs(r.amountUsd);
    else if (r.cls === "BUY") t.buysUsd += Math.abs(r.amountUsd);
  }
  t.netFlowUsd = t.incomeUsd - t.expenseUsd;
  return t;
}

/**
 * Everything the report page needs for one period.
 *
 * `today` is a parameter so the tests are not hostage to the clock.
 */
export function buildReport(
  p: Portfolio,
  kind: PeriodKind,
  anchorDate: string,
  today = new Date().toISOString().slice(0, 10),
): PeriodReport {
  const period = periodFor(kind, anchorDate);
  const previous = shiftPeriod(period, -1);
  const fxAvg = p.fx.average;
  const fxHistory = [...p.fxHistory].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const snaps = [...p.snapshots].sort((a, b) => a.date.localeCompare(b.date));

  /* --- patrimonio ------------------------------------------------------- */
  // The opening balance is the last snapshot *before* the period started: a
  // snapshot dated on day one already includes day one's movements.
  const open = snapshotAsOf(snaps, addDay(period.start, -1));
  const closeAnchor = period.end < today ? period.end : today;
  const close = snapshotAsOf(snaps, closeAnchor);
  const nwOpen = open?.value ?? null;
  const nwClose = close?.value ?? null;
  const nwChange = nwOpen != null && nwClose != null ? nwClose - nwOpen : null;

  const inWindow = snaps.filter(
    (s) => s.date >= period.start && s.date <= closeAnchor,
  );
  const nwSeries: NwPoint[] = inWindow.map((s) => ({
    date: s.date,
    label: `${s.date.slice(8, 10)}/${s.date.slice(5, 7)}`,
    value: s.totalUsd,
  }));
  const values = inWindow.map((s) => s.totalUsd);
  let drawdownPct: number | null = null;
  if (values.length >= 2) {
    let peak = values[0];
    let worst = 0;
    for (const v of values) {
      if (v > peak) peak = v;
      if (peak > 0) worst = Math.min(worst, (v / peak - 1) * 100);
    }
    drawdownPct = worst;
  }

  /* --- flujos ----------------------------------------------------------- */
  const rows = buildRows(
    p.transactions,
    period.start,
    period.end,
    fxHistory,
    fxAvg,
    today,
  );
  // Every total below is built from what has already happened. The ledger also
  // holds the coupon calendar, so an open period contains rows for money that
  // has not arrived; counting them would report a quarter's income halfway
  // through the quarter.
  const done = realised(rows);
  const prevRows = buildRows(
    p.transactions,
    previous.start,
    previous.end,
    fxHistory,
    fxAvg,
    today,
  );
  const totals = totalsOf(done);
  const prevTotals = totalsOf(realised(prevRows));
  const pendingRows = rows.filter((r) => r.future && r.cls === "INCOME");

  const kindMap = new Map<IncomeKind, { amountUsd: number; count: number }>();
  for (const r of done) {
    if (r.cls !== "INCOME") continue;
    const cur = kindMap.get(r.kind) ?? { amountUsd: 0, count: 0 };
    cur.amountUsd += r.amountUsd;
    cur.count += 1;
    kindMap.set(r.kind, cur);
  }
  const incomeByKind: KindTotal[] = INCOME_KINDS.filter((k) =>
    kindMap.has(k),
  ).map((k) => ({
    kind: k,
    label: INCOME_KIND_META[k].label,
    color: INCOME_KIND_META[k].color,
    amountUsd: kindMap.get(k)!.amountUsd,
    count: kindMap.get(k)!.count,
  }));

  const assetName = new Map(p.assets.map((a) => [a.id, a.ticker || a.name]));
  const assetMap = new Map<string, AssetIncomeRow>();
  for (const r of done) {
    if (r.cls !== "INCOME") continue;
    const id = r.tx.assetId;
    // Coupons from a bond that was sold, or never loaded, still hit the cash
    // account — dropping them would understate the period's income.
    const key = id ?? "__none";
    const cur =
      assetMap.get(key) ??
      ({
        assetId: id,
        name: (id && assetName.get(id)) || "Sin activo asociado",
        amountUsd: 0,
        count: 0,
        kinds: [] as IncomeKind[],
      } satisfies AssetIncomeRow);
    cur.amountUsd += r.amountUsd;
    cur.count += 1;
    if (!cur.kinds.includes(r.kind)) cur.kinds.push(r.kind);
    assetMap.set(key, cur);
  }
  const incomeByAsset = [...assetMap.values()].sort(
    (a, b) => b.amountUsd - a.amountUsd,
  );

  const buckets: BucketRow[] = bucketsFor(period).map((b) => {
    const row: BucketRow = {
      key: b.key,
      label: b.label,
      income: 0,
      expense: 0,
      net: 0,
    };
    for (const k of INCOME_KINDS) row[k] = 0;
    for (const r of done) {
      if (r.tx.date < b.start || r.tx.date > b.end) continue;
      if (r.cls === "INCOME") {
        row.income += r.amountUsd;
        row[r.kind] = (row[r.kind] ?? 0) + r.amountUsd;
      } else if (r.cls === "EXPENSE") {
        row.expense += Math.abs(r.amountUsd);
      }
    }
    row.net = row.income - row.expense;
    return row;
  });

  const topPayments = done
    .filter((r) => r.cls === "INCOME")
    .sort((a, b) => b.amountUsd - a.amountUsd)
    .slice(0, 8);

  const feesUsd = done
    .filter(
      (r) =>
        r.cls === "EXPENSE" &&
        /fee|comisi|arancel|derecho/i.test(
          `${r.tx.category ?? ""} ${r.tx.description}`,
        ),
    )
    .reduce((s, r) => s + Math.abs(r.amountUsd), 0);

  /* --- deuda ------------------------------------------------------------ */
  const debtRows = p.liabilities.flatMap((l) =>
    // loanPaymentsFor already refuses anything past its `today`.
    loanPaymentsFor(l.id, p.transactions, closeAnchor)
      .filter((pay) => pay.date >= period.start)
      .map((pay) => ({
        usd: toUsd(
          pay.amount,
          l.currency,
          fxAsOf(fxHistory, pay.date, fxAvg).rate,
        ),
      })),
  );

  /* --- fx --------------------------------------------------------------- */
  const fxOpen = lastAtOrBefore(fxHistory, addDay(period.start, -1));
  const fxClose = lastAtOrBefore(fxHistory, closeAnchor);
  const pctMove = (a: number | undefined, b: number | undefined) =>
    a && b && a > 0 ? (b / a - 1) * 100 : null;

  /* --- lo que viene ----------------------------------------------------- */
  const next = shiftPeriod(period, 1);
  const projected = projectCashflow(
    p.recurring,
    p.transactions,
    fxAvg,
    // Far enough ahead to cover a quarter that starts a quarter from now.
    12,
    p.liabilities,
  ).filter(
    (e) => e.date >= next.start && e.date <= next.end && e.amountUsd > 0,
  );

  const elapsedDays = Math.max(
    0,
    Math.min(period.days, daysBetween(period.start, today) + 1),
  );

  return {
    period,
    previous,
    nwOpen,
    nwOpenDate: open?.date ?? null,
    nwOpenStaleDays: open?.staleDays ?? 0,
    nwClose,
    nwCloseDate: close?.date ?? null,
    nwCloseStaleDays: close?.staleDays ?? 0,
    nwChange,
    nwChangePct:
      nwChange != null && nwOpen != null && nwOpen > 0
        ? (nwChange / nwOpen) * 100
        : null,
    nwSeries,
    nwHigh: values.length ? Math.max(...values) : null,
    nwLow: values.length ? Math.min(...values) : null,
    drawdownPct,
    totals,
    prevTotals,
    incomeByKind,
    incomeByAsset,
    buckets,
    rows,
    topPayments,
    feesUsd,
    residualUsd: nwChange == null ? null : nwChange - totals.netFlowUsd,
    debtPaidUsd: debtRows.reduce((s, d) => s + d.usd, 0),
    debtPaymentCount: debtRows.length,
    fxOpen,
    fxClose,
    blueChangePct: pctMove(fxOpen?.blue, fxClose?.blue),
    mepChangePct: pctMove(fxOpen?.mep, fxClose?.mep),
    projectedNextUsd: projected.reduce((s, e) => s + e.amountUsd, 0),
    projectedNextCount: projected.length,
    pendingUsd: pendingRows.reduce((s, r) => s + r.amountUsd, 0),
    pendingCount: pendingRows.length,
    fxFallbackCount: done.filter((r) => !r.fxFromHistory).length,
    partial: period.end >= today,
    elapsedDays,
  };
}

export type HistoryPoint = {
  label: string;
  start: string;
  incomeUsd: number;
  expenseUsd: number;
  netFlowUsd: number;
  /** Snapshot at the period's close, or null when none was recorded. */
  nwClose: number | null;
  /** True for the period the report is currently showing. */
  current: boolean;
  /** True when the period has not finished, so its bars are not comparable. */
  partial: boolean;
};

/**
 * The same cut over the preceding periods.
 *
 * One month of income is a number; twelve months of income is whether the book
 * is going anywhere. The last bar is usually a period still in progress and is
 * marked as such — a half-finished month plotted next to full ones reads as a
 * collapse in income that has not happened.
 */
export function periodHistory(
  p: Portfolio,
  kind: PeriodKind,
  anchorDate: string,
  count = 12,
  today = new Date().toISOString().slice(0, 10),
): HistoryPoint[] {
  const base = periodFor(kind, anchorDate);
  const fxHistory = [...p.fxHistory].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const snaps = [...p.snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const out: HistoryPoint[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const period = shiftPeriod(base, -i);
    const rows = buildRows(
      p.transactions,
      period.start,
      period.end,
      fxHistory,
      p.fx.average,
      today,
    );
    const t = totalsOf(realised(rows));
    const closeAnchor = period.end < today ? period.end : today;
    out.push({
      label: period.label,
      start: period.start,
      incomeUsd: t.incomeUsd,
      expenseUsd: t.expenseUsd,
      netFlowUsd: t.netFlowUsd,
      nwClose: snapshotAsOf(snaps, closeAnchor)?.value ?? null,
      current: period.start === base.start,
      partial: period.end >= today,
    });
  }
  return out;
}

function lastAtOrBefore(
  rows: FxHistoryRow[],
  date: string,
): FxHistoryRow | null {
  let found: FxHistoryRow | null = null;
  for (const r of rows) {
    if (r.date > date) break;
    found = r;
  }
  return found;
}

function addDay(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------- rendimiento por posición */

export type AssetPerformanceRow = {
  assetId: string;
  name: string;
  ticker: string | null;
  type: string;
  /** Value in USD when the period opened. Null when the position is new. */
  openUsd: number | null;
  closeUsd: number | null;
  openQty: number | null;
  closeQty: number | null;
  /** closeUsd - openUsd. The whole move, flows included. */
  changeUsd: number;
  /**
   * The part of the move that is price: what the units held at the open did.
   * This is the number that answers "how did it do".
   */
  priceUsd: number;
  /** The part of the move that is buying or selling. */
  flowUsd: number;
  /** priceUsd over the opening value — a return, not a share of the total. */
  pricePct: number | null;
  /** True when the position had no row at the open: nothing to measure against. */
  opened: boolean;
  /** True when it has no row at the close: sold, or deleted. */
  closed: boolean;
  /**
   * True when the split between price and flow could not be made because a
   * quantity is missing on one of the two ends. The whole move is then reported
   * as price, which is right for a holding whose size did not change and wrong
   * for one that was topped up — so it is flagged rather than assumed.
   */
  estimated: boolean;
  /** Either end of the move rested on a value with no live quote behind it. */
  unpriced: boolean;
};

export type AssetPerformance = {
  rows: AssetPerformanceRow[];
  /** Sum of priceUsd across positions: what the book earned on what it held. */
  totalPriceUsd: number;
  totalFlowUsd: number;
  totalChangeUsd: number;
  /** Opening value of the positions that had one, for a weighted return. */
  openBaseUsd: number;
  totalPricePct: number | null;
  winners: AssetPerformanceRow[];
  losers: AssetPerformanceRow[];
  /** Rows whose split had to be assumed. */
  estimatedCount: number;
  /** No usable opening snapshot at all: the panel has nothing to say. */
  empty: boolean;
};

/**
 * What each position did between two dates.
 *
 * The move in a holding's value has two causes and they mean different things:
 * the price changed, or its size changed because it was bought or sold. Adding
 * USD 10,000 of a bond is not a USD 10,000 gain, and a report that reads
 * `close - open` as performance says it is.
 *
 * The split is exact when both ends have a quantity:
 *
 *   price = qtyOpen * (priceClose - priceOpen)
 *   flow  = (qtyClose - qtyOpen) * priceClose
 *   price + flow = closeValue - openValue
 *
 * With a quantity missing on either end there is nothing to split on. The move
 * is then reported whole as price — correct for a position whose size did not
 * change, which is the common case for property and for anything held — and the
 * row is marked `estimated` so a topped-up holding is not read as a rally.
 */
export function assetPerformance(
  data: PositionPerformanceData,
  assets: Asset[],
): AssetPerformance {
  const openBy = new Map(data.open.map((r) => [r.assetId, r]));
  const closeBy = new Map(data.close.map((r) => [r.assetId, r]));
  const meta = new Map(assets.map((a) => [a.id, a]));

  const ids = new Set<string>([...openBy.keys(), ...closeBy.keys()]);
  const rows: AssetPerformanceRow[] = [];
  for (const id of ids) {
    const o = openBy.get(id) ?? null;
    const c = closeBy.get(id) ?? null;
    const a = meta.get(id);
    // A snapshot for an asset that no longer exists still describes a real
    // move; it is named from the snapshot rather than dropped.
    const openUsd = o?.valueUsd ?? null;
    const closeUsd = c?.valueUsd ?? null;
    const changeUsd = (closeUsd ?? 0) - (openUsd ?? 0);

    let priceUsd = changeUsd;
    let flowUsd = 0;
    let estimated = true;
    if (o && c && o.quantity != null && c.quantity != null && o.quantity > 0) {
      const unitOpen = o.valueUsd / o.quantity;
      const unitClose = c.quantity > 0 ? c.valueUsd / c.quantity : unitOpen;
      priceUsd = o.quantity * (unitClose - unitOpen);
      flowUsd = (c.quantity - o.quantity) * unitClose;
      estimated = false;
    } else if (!o) {
      // Bought during the period: the entire value is money that came in, not
      // a gain. Reporting it as performance would make every new position the
      // best performer of the month.
      priceUsd = 0;
      flowUsd = changeUsd;
      estimated = false;
    } else if (!c) {
      // Gone from the book. Whether it was sold or deleted is not recorded, so
      // the drop is a flow, not a loss.
      priceUsd = 0;
      flowUsd = changeUsd;
      estimated = false;
    }

    rows.push({
      assetId: id,
      name: a?.name ?? "Posición eliminada",
      ticker: a?.ticker ?? null,
      type: a?.type ?? "OTHER",
      openUsd,
      closeUsd,
      openQty: o?.quantity ?? null,
      closeQty: c?.quantity ?? null,
      changeUsd,
      priceUsd,
      flowUsd,
      pricePct:
        openUsd != null && openUsd > 0 ? (priceUsd / openUsd) * 100 : null,
      opened: !o,
      closed: !c,
      estimated,
      unpriced: Boolean(o?.unpriced || c?.unpriced),
    });
  }

  rows.sort((a, b) => b.priceUsd - a.priceUsd);
  const held = rows.filter((r) => !r.opened && !r.closed);
  const openBaseUsd = held.reduce((s, r) => s + (r.openUsd ?? 0), 0);
  const totalPriceUsd = rows.reduce((s, r) => s + r.priceUsd, 0);
  const ranked = rows.filter((r) => r.pricePct != null && !r.opened);
  return {
    rows,
    totalPriceUsd,
    totalFlowUsd: rows.reduce((s, r) => s + r.flowUsd, 0),
    totalChangeUsd: rows.reduce((s, r) => s + r.changeUsd, 0),
    openBaseUsd,
    totalPricePct: openBaseUsd > 0 ? (totalPriceUsd / openBaseUsd) * 100 : null,
    winners: ranked.filter((r) => r.priceUsd > 0).slice(0, 6),
    // Ascending, so the worst is first rather than buried at the end.
    losers: ranked
      .filter((r) => r.priceUsd < 0)
      .sort((a, b) => a.priceUsd - b.priceUsd)
      .slice(0, 6),
    estimatedCount: rows.filter((r) => r.estimated).length,
    empty: data.open.length === 0,
  };
}
