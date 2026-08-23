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
};

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
): PositionRow[] {
  return assets.map((a) => {
    const valueUsd = toUsd(a.currentValue, a.currency, fxAvg);
    const costUsd = toUsd(a.costBasis, a.currency, fxAvg);
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
    };
  });
}

export type PositionStats = {
  count: number;
  valueUsd: number;
  costUsd: number;
  pnlUsd: number;
  pnlPct: number;
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
