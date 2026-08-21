import { projectCashflow } from "@/lib/portfolio-math";
import type { Asset, Portfolio, Tx } from "@/lib/types";
import { toUsd } from "@/lib/utils";

export type CashFlow = { date: string; amount: number };

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365;
/** Below this, annualising is arithmetic noise: a 3-day move scaled to a year
 *  produces a number nobody should act on, so we report the age instead. */
const MIN_ANNUALISE_YEARS = 30 / YEAR_DAYS;

function years(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso + "T12:00:00Z");
  const b = Date.parse(toIso + "T12:00:00Z");
  return (b - a) / DAY_MS / YEAR_DAYS;
}

function npv(rate: number, flows: CashFlow[], t0: string): number {
  let sum = 0;
  for (const f of flows) {
    const t = years(t0, f.date);
    // (1+r) must stay positive; the caller brackets rate above -1.
    sum += f.amount / Math.pow(1 + rate, t);
  }
  return sum;
}

/**
 * Money-weighted annualised return (XIRR).
 *
 * Solved by bisection rather than Newton-Raphson: irregular personal-portfolio
 * flows routinely produce derivatives near zero, where Newton diverges. Returns
 * null when the flows can't define a rate (all one sign, single date, or no
 * sign change inside the bracket).
 */
export function xirr(flows: CashFlow[]): number | null {
  const clean = flows.filter((f) => Number.isFinite(f.amount) && f.amount !== 0);
  if (clean.length < 2) return null;
  if (!clean.some((f) => f.amount < 0)) return null;
  if (!clean.some((f) => f.amount > 0)) return null;

  const sorted = [...clean].sort((a, b) => a.date.localeCompare(b.date));
  const t0 = sorted[0].date;
  if (sorted[sorted.length - 1].date === t0) return null;

  // Bracket: -99.99% to +1000% annual. Anything outside is not a number worth
  // showing on a dashboard.
  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo, sorted, t0);
  let fHi = npv(hi, sorted, t0);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return null;
  if (fLo * fHi > 0) return null;

  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, sorted, t0);
    if (!Number.isFinite(fMid)) return null;
    if (Math.abs(fMid) < 1e-9 || hi - lo < 1e-9) return mid;
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/** Income actually received (past-dated), as opposed to projected schedule rows. */
const REALISED_INCOME_TYPES = new Set([
  "COUPON",
  "RENT",
  "DIVIDEND",
  "INCOME",
]);

function realisedIncome(transactions: Tx[], today: string, fxAvg: number) {
  return transactions.filter(
    (t) => t.date <= today && REALISED_INCOME_TYPES.has(t.type) &&
      toUsd(t.amount, t.currency, fxAvg) > 0,
  );
}

export type AssetReturn = {
  id: string;
  name: string;
  type: string;
  costUsd: number;
  valueUsd: number;
  incomeUsd: number;
  /**
   * Scheduled income over the next twelve months.
   *
   * A book bought last month has collected nothing yet, so `incomeUsd` is zero
   * across the board and the column reads as if nothing pays anything. This is
   * what the position is contracted to pay, which is the question being asked.
   */
  projectedIncomeUsd: number;
  /** Annualised money-weighted return. Null when the asset has no purchase
   *  date, or when it is too recently held to annualise (see tooShort). */
  annualised: number | null;
  holdingYears: number | null;
  /** Held, but for less than MIN_ANNUALISE_YEARS. */
  tooShort: boolean;
};

/**
 * Per-asset annualised return: cost out on the purchase date, income in as it
 * was received, current value in today.
 */
export function assetReturns(
  assets: Asset[],
  transactions: Tx[],
  fxAvg: number,
  today = new Date().toISOString().slice(0, 10),
  /** Projected income per asset id, from the caller that has the recurring rules. */
  projectedByAsset: Map<string, number> = new Map(),
): AssetReturn[] {
  const income = realisedIncome(transactions, today, fxAvg);
  const byAsset = new Map<string, Tx[]>();
  for (const t of income) {
    if (!t.assetId) continue;
    const list = byAsset.get(t.assetId);
    if (list) list.push(t);
    else byAsset.set(t.assetId, [t]);
  }

  return assets.map((a) => {
    const costUsd = toUsd(a.costBasis, a.currency, fxAvg);
    const valueUsd = toUsd(a.currentValue, a.currency, fxAvg);
    const rows = byAsset.get(a.id) ?? [];
    const incomeUsd = rows.reduce(
      (sum, t) => sum + toUsd(t.amount, t.currency, fxAvg),
      0,
    );

    let annualised: number | null = null;
    let holdingYears: number | null = null;
    let tooShort = false;
    if (a.purchaseDate && a.purchaseDate < today && costUsd > 0) {
      holdingYears = years(a.purchaseDate, today);
      tooShort = holdingYears < MIN_ANNUALISE_YEARS;
      const flows: CashFlow[] = [
        { date: a.purchaseDate, amount: -costUsd },
        ...rows.map((t) => ({
          date: t.date,
          amount: toUsd(t.amount, t.currency, fxAvg),
        })),
        { date: today, amount: valueUsd },
      ];
      annualised = tooShort ? null : xirr(flows);
    }

    return {
      id: a.id,
      name: a.name,
      type: a.type,
      costUsd,
      valueUsd,
      incomeUsd,
      projectedIncomeUsd: projectedByAsset.get(a.id) ?? 0,
      annualised,
      holdingYears,
      tooShort,
    };
  });
}

export type PortfolioReturn = {
  /**
   * Money-weighted annualised return across every dated position, or null when
   * the flows are too recent to annualise.
   */
  annualised: number | null;
  /** Years from the earliest flow to today — how much history the rate rests on. */
  spanYears: number;
  /**
   * Whether the annualised figure deserves to be the headline. Below a year it
   * is an extrapolation from a short window, so the measured total leads.
   */
  annualisedLeads: boolean;
  /** Total return over the covered period, not annualised. */
  simple: number | null;
  costUsd: number;
  valueUsd: number;
  incomeUsd: number;
  /** How much of the book the number actually covers. */
  covered: number;
  total: number;
  coveredValueUsd: number;
  uncoveredValueUsd: number;
  perAsset: AssetReturn[];
};

/**
 * Portfolio-level money-weighted return.
 *
 * Only positions carrying a purchase date can contribute a dated outflow, so
 * the result reports its own coverage rather than quietly answering for part
 * of the book.
 */
export function portfolioReturn(
  p: Portfolio,
  today = new Date().toISOString().slice(0, 10),
): PortfolioReturn {
  const fxAvg = p.fx.average;

  // Contracted income for the year ahead, by asset — coupons and amortizations
  // from the dated schedule plus the recurring rules, deduplicated.
  const projectedByAsset = new Map<string, number>();
  for (const e of projectCashflow(p.recurring, p.transactions, fxAvg, 12)) {
    if (!e.assetId) continue;
    projectedByAsset.set(
      e.assetId,
      (projectedByAsset.get(e.assetId) ?? 0) + e.amountUsd,
    );
  }

  const per = assetReturns(
    p.assets,
    p.transactions,
    fxAvg,
    today,
    projectedByAsset,
  );
  const dated = per.filter((r) => r.holdingYears !== null && r.costUsd > 0);

  const flows: CashFlow[] = [];
  let costUsd = 0;
  let valueUsd = 0;
  let incomeUsd = 0;

  for (const r of dated) {
    const asset = p.assets.find((a) => a.id === r.id);
    if (!asset?.purchaseDate) continue;
    flows.push({ date: asset.purchaseDate, amount: -r.costUsd });
    costUsd += r.costUsd;
    valueUsd += r.valueUsd;
    incomeUsd += r.incomeUsd;
  }
  for (const t of realisedIncome(p.transactions, today, fxAvg)) {
    // Income from an undated position still belongs to the covered flows only
    // if its asset is in the covered set.
    if (t.assetId && !dated.some((d) => d.id === t.assetId)) continue;
    flows.push({ date: t.date, amount: toUsd(t.amount, t.currency, fxAvg) });
  }
  if (valueUsd > 0) flows.push({ date: today, amount: valueUsd });

  const uncoveredValueUsd = per
    .filter((r) => r.holdingYears === null || r.costUsd <= 0)
    .reduce((sum, r) => sum + r.valueUsd, 0);

  // Same floor the per-asset rows use. Annualising a few weeks compounds a
  // short-run move into a yearly rate: +5% over five weeks reads as +65%/yr,
  // which is arithmetic, not information. Suppressing it per row and then
  // printing it as the headline was inconsistent.
  const firstFlow = flows.reduce<string | null>(
    (min, f) => (min === null || f.date < min ? f.date : min),
    null,
  );
  const spanYears = firstFlow ? years(firstFlow, today) : 0;

  const rate = spanYears >= MIN_ANNUALISE_YEARS ? xirr(flows) : null;

  return {
    annualised: rate,
    spanYears,
    annualisedLeads: spanYears >= 1 && rate !== null,
    simple: costUsd > 0 ? (valueUsd + incomeUsd - costUsd) / costUsd : null,
    costUsd,
    valueUsd,
    incomeUsd,
    covered: dated.length,
    total: per.length,
    coveredValueUsd: valueUsd,
    uncoveredValueUsd,
    perAsset: per,
  };
}
