import type { Asset } from "@/lib/types";
import { toUsd } from "@/lib/utils";

/**
 * Per-position numbers for the POS table and its breakdown.
 *
 * Everything here is derived, never stored: the assets table holds a position
 * value and a cost basis, and a unit price is that divided by a quantity. The
 * division is the whole reason this file is careful — a per-unit price computed
 * against a quantity that isn't there is the same class of bug that once put a
 * $496 unit price in a column reading "value of the position".
 */

/**
 * The quantity a per-unit price can honestly be divided by, or null.
 *
 * `1` is the form's sentinel for "left blank" (see components/asset-form.tsx),
 * so it is not evidence of a one-unit holding. Treating it as one would print a
 * unit price equal to the whole position — a number that is arithmetically
 * fine and financially meaningless.
 */
export function unitCount(a: Pick<Asset, "quantity">): number | null {
  if (a.quantity == null) return null;
  if (!(a.quantity > 0)) return null;
  if (a.quantity === 1) return null;
  return a.quantity;
}

/**
 * Bonds are quoted per 100 nominal — an ON at 104.43 trades at 1.0443 times
 * face — and `quantity` on a bond is the nominal, not a number of units. So
 * value/nominal comes out as 1.0443, which is right and unreadable next to a
 * broker screen showing 104.43. These are scaled to the market convention and
 * flagged, so the column can say which convention it is using.
 */
export function quotedPerHundred(type: string): boolean {
  return type === "BOND";
}

export type PositionRow = {
  asset: Asset;
  typeLabel: string;
  valueUsd: number;
  costUsd: number;
  pnlUsd: number;
  pnlPct: number;
  /** Units the prices are per, or null when there is no usable quantity. */
  quantity: number | null;
  /** Cost per unit, in the asset's own currency. Null without a quantity. */
  buyPrice: number | null;
  /** Current price per unit, in the asset's own currency. */
  nowPrice: number | null;
  /**
   * Move in the unit price. Equal to pnlPct whenever both sides are divided by
   * the same quantity, and it is — but only the per-unit figures are shown next
   * to it, so it is computed from them.
   */
  pricePct: number | null;
  /** True when buyPrice/nowPrice are per 100 nominal rather than per unit. */
  perHundred: boolean;
  /** No live quote: the value shown is the cost basis standing in for one. */
  unpriced: boolean;
  /**
   * Rent, coupons and dividends actually collected on this position, in USD.
   *
   * Appreciation alone understates a property or a bond: a flat that has not
   * moved in price but has paid two years of rent shows P&L 0, which is not
   * what it did. Kept apart from the price P&L rather than folded into it —
   * they answer different questions, and a single merged number would hide
   * which one moved.
   */
  incomeUsd: number;
  /** Income contracted over the next twelve months. */
  projectedIncomeUsd: number;
  /** Price P&L plus income collected: what the position actually returned. */
  totalUsd: number;
  /** totalUsd over cost. Null without a cost basis to divide by. */
  totalPct: number | null;
};

/** Per-asset income, keyed by asset id. See lib/returns.ts assetReturns. */
export type IncomeByAsset = Map<
  string,
  { incomeUsd: number; projectedIncomeUsd: number }
>;

/**
 * One row per asset, already converted to USD for the totals and left in the
 * asset's own currency for the prices.
 *
 * Prices stay in the position's currency on purpose: an ARS-denominated CEDEAR
 * is bought and quoted in pesos, and converting its unit price to dollars at
 * today's FX would make it uncomparable with the broker's own screen — the one
 * place a holder can check it.
 */
export function positionRows(
  assets: Asset[],
  fxAvg: number,
  typeLabels: Record<string, string> = {},
  income: IncomeByAsset = new Map(),
): PositionRow[] {
  return assets.map((a) => {
    const valueUsd = toUsd(a.currentValue, a.currency, fxAvg);
    const costUsd = toUsd(a.costBasis, a.currency, fxAvg);
    const inc = income.get(a.id);
    const incomeUsd = inc?.incomeUsd ?? 0;
    const qty = unitCount(a);
    const perHundred = quotedPerHundred(a.type);
    const scale = perHundred ? 100 : 1;
    const buyPrice = qty ? (a.costBasis / qty) * scale : null;
    // An unpriced asset's currentValue is its cost standing in for a quote, so
    // there is no current price to report — saying "same as cost" would dress
    // the fallback up as a flat market.
    const nowPrice = qty && !a.unpriced ? (a.currentValue / qty) * scale : null;
    return {
      asset: a,
      typeLabel: typeLabels[a.type] ?? a.type,
      valueUsd,
      costUsd,
      pnlUsd: valueUsd - costUsd,
      pnlPct: costUsd > 0 ? ((valueUsd - costUsd) / costUsd) * 100 : 0,
      quantity: qty,
      buyPrice,
      nowPrice,
      pricePct:
        buyPrice && nowPrice && buyPrice > 0
          ? ((nowPrice - buyPrice) / buyPrice) * 100
          : null,
      perHundred,
      unpriced: a.unpriced,
      incomeUsd,
      projectedIncomeUsd: inc?.projectedIncomeUsd ?? 0,
      totalUsd: valueUsd - costUsd + incomeUsd,
      totalPct:
        costUsd > 0 ? ((valueUsd - costUsd + incomeUsd) / costUsd) * 100 : null,
    };
  });
}

export type PositionStats = {
  count: number;
  valueUsd: number;
  costUsd: number;
  pnlUsd: number;
  pnlPct: number;
  /** Rent, coupons and dividends collected across the shown positions. */
  incomeUsd: number;
  /** Income contracted for the next twelve months. */
  projectedIncomeUsd: number;
  /** Price P&L plus income. */
  totalUsd: number;
  totalPct: number | null;
  /** Largest single position as a share of the shown value. */
  topWeightPct: number;
  topName: string | null;
  best: PositionRow | null;
  worst: PositionRow | null;
  /** Positions carrying a cost but no live quote. */
  unpricedCount: number;
  /** Positions whose per-unit price could not be computed. */
  noQuantityCount: number;
};

/**
 * Totals for whatever set of rows is on screen.
 *
 * best/worst rank by percentage rather than by dollars, because on a book with
 * one large holding the dollar ranking only ever names that holding.
 */
export function positionStats(rows: PositionRow[]): PositionStats {
  const valueUsd = rows.reduce((s, r) => s + r.valueUsd, 0);
  const costUsd = rows.reduce((s, r) => s + r.costUsd, 0);
  const incomeUsd = rows.reduce((s, r) => s + r.incomeUsd, 0);
  // Only positions with a real cost basis can have a percentage return.
  const ranked = rows
    .filter((r) => r.costUsd > 0)
    .sort((a, b) => b.pnlPct - a.pnlPct);
  const top = [...rows].sort((a, b) => b.valueUsd - a.valueUsd)[0] ?? null;
  return {
    count: rows.length,
    valueUsd,
    costUsd,
    pnlUsd: valueUsd - costUsd,
    pnlPct: costUsd > 0 ? ((valueUsd - costUsd) / costUsd) * 100 : 0,
    incomeUsd,
    projectedIncomeUsd: rows.reduce((s, r) => s + r.projectedIncomeUsd, 0),
    totalUsd: valueUsd - costUsd + incomeUsd,
    totalPct:
      costUsd > 0 ? ((valueUsd - costUsd + incomeUsd) / costUsd) * 100 : null,
    topWeightPct: top && valueUsd > 0 ? (top.valueUsd / valueUsd) * 100 : 0,
    topName: top ? top.asset.ticker || top.asset.name : null,
    best: ranked[0] ?? null,
    worst: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    unpricedCount: rows.filter((r) => r.unpriced).length,
    noQuantityCount: rows.filter((r) => r.quantity == null).length,
  };
}

export type BreakdownSlice = {
  key: string;
  label: string;
  valueUsd: number;
  costUsd: number;
  pnlUsd: number;
  pnlPct: number;
  weightPct: number;
  count: number;
};

/**
 * How the shown value splits up.
 *
 * Grouped by asset class when looking at everything, and by individual position
 * once a class is selected — on the CRYPTO tab a bar per class would be a
 * single bar, which is not a breakdown.
 */
export function positionBreakdown(
  rows: PositionRow[],
  groupBy: "type" | "position",
): BreakdownSlice[] {
  const total = rows.reduce((s, r) => s + r.valueUsd, 0);
  const map = new Map<string, BreakdownSlice>();
  for (const r of rows) {
    const key = groupBy === "type" ? r.asset.type : r.asset.id;
    const label =
      groupBy === "type" ? r.typeLabel : r.asset.ticker || r.asset.name;
    const cur =
      map.get(key) ??
      ({
        key,
        label,
        valueUsd: 0,
        costUsd: 0,
        pnlUsd: 0,
        pnlPct: 0,
        weightPct: 0,
        count: 0,
      } satisfies BreakdownSlice);
    cur.valueUsd += r.valueUsd;
    cur.costUsd += r.costUsd;
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((s) => ({
      ...s,
      pnlUsd: s.valueUsd - s.costUsd,
      pnlPct: s.costUsd > 0 ? ((s.valueUsd - s.costUsd) / s.costUsd) * 100 : 0,
      weightPct: total > 0 ? (s.valueUsd / total) * 100 : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

export type CategoryPie = {
  type: string;
  label: string;
  valueUsd: number;
  costUsd: number;
  /** Income collected across this category. */
  incomeUsd: number;
  pnlUsd: number;
  /** Share of the whole shown book that this category is. */
  bookPct: number;
  /** One entry per position, descending, with its share **of this category**. */
  items: {
    id: string;
    label: string;
    valueUsd: number;
    pnlUsd: number;
    pnlPct: number;
    incomeUsd: number;
    totalUsd: number;
    totalPct: number | null;
    /** Percentage of the category, not of the portfolio. */
    pct: number;
    unpriced: boolean;
  }[];
};

/**
 * Each asset class split into the positions inside it.
 *
 * The percentage on an item is its share **of its own category**, which is the
 * question being asked — "of my crypto, how much is BTC" — and not its share of
 * the book, which the WGT column in the table already answers. Mixing the two
 * denominators in one view is how a 60%-of-crypto holding gets read as 60% of
 * the portfolio.
 */
export function categoryPies(rows: PositionRow[]): CategoryPie[] {
  const bookTotal = rows.reduce((s, r) => s + r.valueUsd, 0);
  const byType = new Map<string, PositionRow[]>();
  for (const r of rows) {
    const list = byType.get(r.asset.type) ?? [];
    list.push(r);
    byType.set(r.asset.type, list);
  }
  return [...byType.entries()]
    .map(([type, list]) => {
      const valueUsd = list.reduce((s, r) => s + r.valueUsd, 0);
      const costUsd = list.reduce((s, r) => s + r.costUsd, 0);
      const incomeUsd = list.reduce((s, r) => s + r.incomeUsd, 0);
      return {
        type,
        label: list[0]?.typeLabel ?? type,
        valueUsd,
        costUsd,
        incomeUsd,
        pnlUsd: valueUsd - costUsd,
        bookPct: bookTotal > 0 ? (valueUsd / bookTotal) * 100 : 0,
        items: [...list]
          .sort((a, b) => b.valueUsd - a.valueUsd)
          .map((r) => ({
            id: r.asset.id,
            label: r.asset.ticker || r.asset.name,
            valueUsd: r.valueUsd,
            pnlUsd: r.pnlUsd,
            pnlPct: r.pnlPct,
            incomeUsd: r.incomeUsd,
            totalUsd: r.totalUsd,
            totalPct: r.totalPct,
            pct: valueUsd > 0 ? (r.valueUsd / valueUsd) * 100 : 0,
            unpriced: r.unpriced,
          })),
      };
    })
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

/**
 * A price with enough decimals to be worth printing.
 *
 * A crypto unit can cost $0.0004 and a CEDEAR $12,340; a fixed two decimals
 * renders the first as $0.00, which is not a price. The rule is significance,
 * not a fixed width.
 */
export function formatUnitPrice(value: number, currency: string): string {
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 0 : abs >= 10 ? 2 : abs >= 0.1 ? 4 : 8;
  const code = (currency || "USD").toUpperCase();
  return new Intl.NumberFormat(code === "ARS" ? "es-AR" : "en-US", {
    style: "currency",
    currency: code === "USDT" ? "USD" : code,
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

/* ------------------------------------------------------- flujos proyectados */

export type FlowMonth = {
  /** YYYY-MM. */
  key: string;
  label: string;
  totalUsd: number;
  /** One entry per paying position in that month. */
  items: { assetId: string; name: string; amountUsd: number }[];
};

export type FlowProjection = {
  months: FlowMonth[];
  totalUsd: number;
  /** Months with at least one payment, for an honest average. */
  payingMonths: number;
  /** Average across paying months, not across the calendar. */
  avgPerPayingMonth: number;
  /** Biggest month in the window. */
  peak: FlowMonth | null;
  eventCount: number;
  /** Total over the window as a percentage of what the positions are worth. */
  yieldPct: number | null;
};

/**
 * Scheduled income from a set of positions, by month.
 *
 * The average is over the months that actually pay, not over the calendar: a
 * portfolio of semi-annual bonds pays in two months out of twelve, and dividing
 * by twelve describes a monthly income that never arrives. The calendar total
 * is right there beside it for whoever wants the other number.
 */
export function flowProjection(
  events: { date: string; name: string; amountUsd: number; assetId: string }[],
  assetIds: Set<string>,
  monthLabelOf: (iso: string) => string,
  positionValueUsd = 0,
): FlowProjection {
  const mine = events.filter((e) => assetIds.has(e.assetId) && e.amountUsd > 0);
  const byMonth = new Map<string, FlowMonth>();
  for (const e of mine) {
    const key = e.date.slice(0, 7);
    const month =
      byMonth.get(key) ??
      ({ key, label: monthLabelOf(key), totalUsd: 0, items: [] } as FlowMonth);
    month.totalUsd += e.amountUsd;
    const existing = month.items.find((i) => i.assetId === e.assetId);
    // Two coupons from the same bond in one month are one line, not two.
    if (existing) existing.amountUsd += e.amountUsd;
    else
      month.items.push({
        assetId: e.assetId,
        name: e.name,
        amountUsd: e.amountUsd,
      });
    byMonth.set(key, month);
  }
  const months = [...byMonth.values()].sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  for (const m of months) m.items.sort((a, b) => b.amountUsd - a.amountUsd);
  const totalUsd = months.reduce((s, m) => s + m.totalUsd, 0);
  const paying = months.filter((m) => m.totalUsd > 0);
  return {
    months,
    totalUsd,
    payingMonths: paying.length,
    avgPerPayingMonth: paying.length > 0 ? totalUsd / paying.length : 0,
    peak:
      months.length > 0
        ? months.reduce((a, b) => (b.totalUsd > a.totalUsd ? b : a))
        : null,
    eventCount: mine.length,
    yieldPct: positionValueUsd > 0 ? (totalUsd / positionValueUsd) * 100 : null,
  };
}
