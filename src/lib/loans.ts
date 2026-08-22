import type { Liability, Tx } from "@/lib/types";

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
  /**
   * True when the outstanding principal comes from recorded payments rather
   * than from the calendar. Without payments logged the schedule is only a
   * projection, and saying so is the difference between a fact and a guess.
   */
  fromPayments: boolean;
  /** Interest run up since the last recorded payment. */
  accruedInterest: number;
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
  /** Recorded payments; when empty the status falls back to the projection. */
  payments: LoanPayment[] = [],
): LoanStatus {
  const principal = l.principal ?? 0;
  const term = l.termPeriods ?? 0;
  const start = l.startDate;
  const rate = l.interestRate ?? 0;

  if (!(principal > 0) || !(term > 0) || !start) {
    return {
      scheduled: false,
      fromPayments: false,
      accruedInterest: 0,
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
  const future = schedule.filter((r) => r.date > today);
  const next = future[0] ?? null;
  const payment = loanPayment(principal, rate, term, frequency);

  // Recorded payments win over the calendar: they are what happened.
  if (payments.length > 0) {
    const replay = replayLoan(l, payments, today);
    const remaining = Math.max(0, term - replay.paidCount);
    const dueAfter = schedule.filter((r) => r.n > replay.paidCount);
    return {
      scheduled: true,
      fromPayments: true,
      accruedInterest: replay.accruedInterest,
      payment,
      schedule,
      paid: replay.paidCount,
      remaining,
      outstanding: replay.balance,
      nextDate: dueAfter[0]?.date ?? null,
      nextPayment: dueAfter[0] ? payment : null,
      interestPaid: replay.interestPaid,
      interestRemaining: dueAfter.reduce((s, r) => s + r.interest, 0),
      interestTotal: schedule.reduce((s, r) => s + r.interest, 0),
      lastDate: schedule[schedule.length - 1]?.date ?? null,
    };
  }

  // Nothing logged: the whole schedule is still ahead. The calendar is not
  // evidence that an instalment was paid.
  return {
    scheduled: true,
    fromPayments: false,
    accruedInterest: 0,
    payment,
    schedule,
    paid: 0,
    remaining: term,
    outstanding: principal,
    nextDate: next?.date ?? schedule[0]?.date ?? null,
    nextPayment: next ? payment : null,
    interestPaid: 0,
    interestRemaining: schedule.reduce((s, r) => s + r.interest, 0),
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
  payments: LoanPayment[] = [],
): number {
  const status = loanStatus(l, today, payments);
  return status.scheduled ? status.outstanding : l.balance;
}

/* ------------------------------------------------------- payments actually made */

/**
 * Elapsed periods between two dates, in the loan's own frequency.
 *
 * Counted in calendar months rather than in days: a bank charges one period of
 * interest per instalment regardless of whether the month had 28 days or 31,
 * so an actual/365 accrual drifts away from the coupon book — about USD 20 over
 * six instalments on a 100k loan, which is small, wrong, and exactly the kind
 * of gap that stops a balance from tying out to the statement.
 *
 * The day-of-month remainder keeps an off-schedule payment proportional.
 */
function periodsBetween(
  fromIso: string,
  toIso: string,
  frequency: string,
): number {
  const a = new Date(fromIso + "T12:00:00Z");
  const b = new Date(toIso + "T12:00:00Z");
  const months =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth()) +
    (b.getUTCDate() - a.getUTCDate()) / 30;
  const monthsPerPeriod = 12 / periodsPerYear(frequency);
  return months / monthsPerPeriod;
}

export type LoanPayment = { date: string; amount: number };

/** Payments recorded against a liability, oldest first, positive amounts. */
export function loanPaymentsFor(
  liabilityId: string,
  transactions: Tx[],
  today = new Date().toISOString().slice(0, 10),
): LoanPayment[] {
  return transactions
    .filter((t) => t.liabilityId === liabilityId && t.date <= today)
    .map((t) => ({ date: t.date, amount: Math.abs(t.amount) }))
    .filter((p) => p.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type LoanReplay = {
  balance: number;
  principalPaid: number;
  interestPaid: number;
  paidCount: number;
  /** Interest run up since the last payment and not yet covered. */
  accruedInterest: number;
  lastPaymentDate: string | null;
};

/**
 * Rebuild the outstanding principal from the payments that were actually made.
 *
 * Interest accrues on the balance over the real number of days between
 * payments (actual/365, the convention used everywhere else here), so a payment
 * made early, late, or for an unusual amount lands where it belongs instead of
 * being forced onto the scheduled grid. Anything above the interest due reduces
 * capital, which is what makes an extra principal payment work.
 */
export function replayLoan(
  l: Liability,
  payments: LoanPayment[],
  today = new Date().toISOString().slice(0, 10),
): LoanReplay {
  const principal = l.principal ?? 0;
  const frequency = l.paymentFrequency || "MONTHLY";
  // Periodic rate, the same one the schedule uses.
  const i = (l.interestRate ?? 0) / 100 / periodsPerYear(frequency);
  const start = l.startDate;

  let balance = principal;
  let principalPaid = 0;
  let interestPaid = 0;
  let cursor = start ?? (payments[0]?.date ?? today);

  for (const p of payments) {
    const periods = Math.max(0, periodsBetween(cursor, p.date, frequency));
    const interest = balance * i * periods;
    // Interest first, remainder against capital — a payment short of the
    // interest due leaves the balance growing, which is the truth.
    const toPrincipal = p.amount - interest;
    interestPaid += Math.min(p.amount, interest);
    if (toPrincipal > 0) {
      principalPaid += Math.min(toPrincipal, balance);
      balance = Math.max(0, balance - toPrincipal);
    } else {
      balance += -toPrincipal;
    }
    cursor = p.date;
  }

  const sinceLast = Math.max(0, periodsBetween(cursor, today, frequency));
  return {
    balance,
    principalPaid,
    interestPaid,
    paidCount: payments.length,
    accruedInterest: balance * i * sinceLast,
    lastPaymentDate: payments[payments.length - 1]?.date ?? null,
  };
}
