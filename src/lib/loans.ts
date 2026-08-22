import type { Liability } from "@/lib/types";

/** Payments per year, by frequency. */
const PERIODS_PER_YEAR: Record<string, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  SEMI_ANNUAL: 2,
  ANNUAL: 1,
};

export function periodsPerYear(frequency: string): number {
  return PERIODS_PER_YEAR[frequency] ?? 12;
}

function addPeriods(iso: string, frequency: string, count: number): string {
  const d = new Date(iso + "T12:00:00Z");
  const monthsPerPeriod = 12 / periodsPerYear(frequency);
  d.setUTCMonth(d.getUTCMonth() + monthsPerPeriod * count);
  return d.toISOString().slice(0, 10);
}

/**
 * Fixed instalment under the French system — equal payments, with the split
 * between interest and principal shifting over the life of the loan. It is what
 * an Argentine bank quotes, so it is what a holder can check against a coupon
 * book.
 *
 * A zero rate divides evenly instead of dividing by zero.
 */
export function loanPayment(
  principal: number,
  annualRatePct: number,
  termPeriods: number,
  frequency = "MONTHLY",
): number {
  if (!(principal > 0) || !(termPeriods > 0)) return 0;
  const i = annualRatePct / 100 / periodsPerYear(frequency);
  if (i <= 0) return principal / termPeriods;
  return (principal * i) / (1 - Math.pow(1 + i, -termPeriods));
}

export type AmortRow = {
  n: number;
  date: string;
  payment: number;
  interest: number;
  principal: number;
  /** Outstanding after this payment. */
  balance: number;
};

/**
 * Full payment schedule.
 *
 * The final instalment absorbs the rounding drift so the balance lands exactly
 * on zero rather than a few cents either side.
 */
export function amortizationSchedule(
  principal: number,
  annualRatePct: number,
  termPeriods: number,
  startDate: string,
  frequency = "MONTHLY",
): AmortRow[] {
  if (!(principal > 0) || !(termPeriods > 0)) return [];
  const i = annualRatePct / 100 / periodsPerYear(frequency);
  const payment = loanPayment(principal, annualRatePct, termPeriods, frequency);

  const rows: AmortRow[] = [];
  let balance = principal;
  for (let n = 1; n <= termPeriods; n += 1) {
    const interest = balance * i;
    let principalPart = payment - interest;
    let due = payment;
    if (n === termPeriods) {
      // Last one clears whatever is left.
      principalPart = balance;
      due = balance + interest;
    }
    balance = Math.max(0, balance - principalPart);
    rows.push({
      n,
      date: addPeriods(startDate, frequency, n),
      payment: due,
      interest,
      principal: principalPart,
      balance,
    });
  }
  return rows;
}

export type LoanStatus = {
  /** True when the liability carries enough data to build a schedule. */
  scheduled: boolean;
  payment: number;
  schedule: AmortRow[];
  paid: number;
  remaining: number;
  /** Outstanding principal today, from the schedule. */
  outstanding: number;
  nextDate: string | null;
  nextPayment: number | null;
  interestPaid: number;
  interestRemaining: number;
  /** Total interest over the life of the loan. */
  interestTotal: number;
  lastDate: string | null;
};

/**
 * Where a loan stands today.
 *
 * Without a principal, a term and a start date there is no schedule to derive,
 * so `scheduled` is false and the caller keeps using the manually entered
 * balance rather than inventing one.
 */
export function loanStatus(
  l: Liability,
  today = new Date().toISOString().slice(0, 10),
): LoanStatus {
  const principal = l.principal ?? 0;
  const term = l.termPeriods ?? 0;
  const start = l.startDate;
  const rate = l.interestRate ?? 0;

  if (!(principal > 0) || !(term > 0) || !start) {
    return {
      scheduled: false,
      payment: 0,
      schedule: [],
      paid: 0,
      remaining: 0,
      outstanding: l.balance,
      nextDate: null,
      nextPayment: null,
      interestPaid: 0,
      interestRemaining: 0,
      interestTotal: 0,
      lastDate: null,
    };
  }

  const frequency = l.paymentFrequency || "MONTHLY";
  const schedule = amortizationSchedule(principal, rate, term, start, frequency);
  const past = schedule.filter((r) => r.date <= today);
  const future = schedule.filter((r) => r.date > today);
  const next = future[0] ?? null;

  return {
    scheduled: true,
    payment: loanPayment(principal, rate, term, frequency),
    schedule,
    paid: past.length,
    remaining: future.length,
    outstanding: past.length > 0 ? past[past.length - 1].balance : principal,
    nextDate: next?.date ?? null,
    nextPayment: next?.payment ?? null,
    interestPaid: past.reduce((s, r) => s + r.interest, 0),
    interestRemaining: future.reduce((s, r) => s + r.interest, 0),
    interestTotal: schedule.reduce((s, r) => s + r.interest, 0),
    lastDate: schedule[schedule.length - 1]?.date ?? null,
  };
}

/**
 * What a liability is actually worth owing today.
 *
 * With a schedule the outstanding principal is derived, because the manually
 * entered balance is a snapshot that goes stale the moment an instalment is
 * paid — leaving the DEBT tile and the loan panel showing different numbers for
 * the same debt. Without a schedule the entered balance is all there is.
 */
export function liabilityBalance(
  l: Liability,
  today = new Date().toISOString().slice(0, 10),
): number {
  const status = loanStatus(l, today);
  return status.scheduled ? status.outstanding : l.balance;
}
