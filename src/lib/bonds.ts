import { xirr, type CashFlow } from "@/lib/returns";
import type { Asset, Tx } from "@/lib/types";
import { toUsd } from "@/lib/utils";

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365;

function years(fromIso: string, toIso: string): number {
  return (
    (Date.parse(toIso + "T12:00:00Z") - Date.parse(fromIso + "T12:00:00Z")) /
    DAY_MS /
    YEAR_DAYS
  );
}

/** Rows that actually pay the holder: coupons and principal repayments. */
const PAYING_TYPES = new Set([
  "COUPON",
  "AMORT",
  "SELL",
  "INCOME",
  "RENT",
  "DIVIDEND",
]);

/** Principal, not income. Excluded from current yield: getting your own capital
 *  back is not a return, and counting it produced yields above 100% on bonds
 *  maturing within the year. */
const PRINCIPAL_TYPES = new Set(["AMORT", "SELL"]);

export type BondMetrics = {
  id: string;
  name: string;
  priceUsd: number;
  /** Current yield: next 12 months of income over price. */
  currentYield: number | null;
  /** Yield to maturity: the IRR of paying price today for the whole schedule. */
  ytm: number | null;
  /** Macaulay duration in years — the PV-weighted average time to payment. */
  macaulay: number | null;
  /** Modified duration: approximate % price move per 1pp yield move. */
  modified: number | null;
  nextDate: string | null;
  nextAmountUsd: number | null;
  maturity: string | null;
  totalFutureUsd: number;
  payments: number;
};

/**
 * Bond analytics from the stored payment schedule.
 *
 * The schedule already lives in the transactions table as dated rows per bond,
 * so YTM is just the IRR of "pay today's price, receive every future payment" —
 * the same solver the portfolio return uses.
 *
 * Note this is a yield on the *position* as valued, not a clean-price street
 * yield: it ignores accrued interest and any day-count convention beyond
 * actual/365.
 */
export function bondMetrics(
  assets: Asset[],
  transactions: Tx[],
  fxAvg: number,
  today = new Date().toISOString().slice(0, 10),
): BondMetrics[] {
  const bonds = assets.filter((a) => a.type === "BOND");
  const oneYearOut = new Date(Date.parse(today + "T12:00:00Z") + 365 * DAY_MS)
    .toISOString()
    .slice(0, 10);

  return bonds
    .map((b) => {
      const priceUsd = toUsd(b.currentValue, b.currency, fxAvg);

      const scheduled = transactions
        .filter(
          (t) =>
            t.assetId === b.id &&
            t.date > today &&
            PAYING_TYPES.has(t.type) &&
            toUsd(t.amount, t.currency, fxAvg) > 0,
        )
        .map((t) => ({
          date: t.date,
          amount: toUsd(t.amount, t.currency, fxAvg),
          principal: PRINCIPAL_TYPES.has(t.type),
        }))
        .sort((x, y) => x.date.localeCompare(y.date));

      const future = scheduled.map(({ date, amount }) => ({ date, amount }));
      const totalFutureUsd = future.reduce((s, f) => s + f.amount, 0);
      // Coupons only — see PRINCIPAL_TYPES.
      const next12m = scheduled
        .filter((f) => !f.principal && f.date <= oneYearOut)
        .reduce((s, f) => s + f.amount, 0);

      let ytm: number | null = null;
      let macaulay: number | null = null;
      let modified: number | null = null;

      if (priceUsd > 0 && future.length > 0) {
        const flows: CashFlow[] = [
          { date: today, amount: -priceUsd },
          ...future,
        ];
        ytm = xirr(flows);

        if (ytm !== null && ytm > -1) {
          // Discount each payment at the solved yield; the PV sum should equal
          // price, but we divide by the computed sum so a near-miss on the
          // solve cannot skew the weighting.
          let pvSum = 0;
          let weighted = 0;
          for (const f of future) {
            const t = years(today, f.date);
            const pv = f.amount / Math.pow(1 + ytm, t);
            pvSum += pv;
            weighted += t * pv;
          }
          if (pvSum > 0) {
            macaulay = weighted / pvSum;
            modified = macaulay / (1 + ytm);
          }
        }
      }

      return {
        id: b.id,
        name: b.ticker || b.name,
        priceUsd,
        currentYield: priceUsd > 0 ? next12m / priceUsd : null,
        ytm,
        macaulay,
        modified,
        nextDate: future[0]?.date ?? null,
        nextAmountUsd: future[0]?.amount ?? null,
        maturity: future[future.length - 1]?.date ?? null,
        totalFutureUsd,
        payments: future.length,
      };
    })
    .sort((a, b) => (b.ytm ?? -Infinity) - (a.ytm ?? -Infinity));
}
