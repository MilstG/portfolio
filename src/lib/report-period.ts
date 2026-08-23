import { monthLabel } from "@/lib/utils";

/** The three windows a report can be cut on. */
export type PeriodKind = "WEEK" | "MONTH" | "QUARTER";

export const PERIOD_KINDS: { value: PeriodKind; label: string }[] = [
  { value: "WEEK", label: "SEMANAL" },
  { value: "MONTH", label: "MENSUAL" },
  { value: "QUARTER", label: "TRIMESTRAL" },
];

export type Period = {
  kind: PeriodKind;
  /** Inclusive. */
  start: string;
  /** Inclusive. */
  end: string;
  label: string;
  /** Long form for the page header. */
  title: string;
  /** Days in the window, inclusive of both ends. */
  days: number;
};

const MS_DAY = 86_400_000;

function utc(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, days: number): string {
  return iso(new Date(utc(isoDate).getTime() + days * MS_DAY));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b).getTime() - utc(a).getTime()) / MS_DAY);
}

/**
 * Monday-start weeks.
 *
 * Argentine brokers settle on business days and the holder reads a week as
 * Monday to Sunday; a Sunday-start week would split every settlement week in
 * two and make a "weekly" income figure land in the wrong report.
 */
function weekStart(isoDate: string): string {
  const d = utc(isoDate);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  return addDaysIso(isoDate, -dow);
}

function quarterOf(month: number): number {
  return Math.floor(month / 3);
}

/**
 * ISO week number and the year that week belongs to.
 *
 * The two can disagree with the calendar: the week starting Mon 2024-12-30 is
 * week 1 of 2025, and taking the year from the start date would label it
 * "S01 2024" — a heading naming a week that is not the week being reported, and
 * one that sorts before the fifty-two weeks it comes after.
 *
 * The Thursday decides both, which is what makes it ISO.
 */
function isoWeek(isoDate: string): { year: number; week: number } {
  const thursday = new Date(utc(weekStart(isoDate)).getTime() + 3 * MS_DAY);
  const year = thursday.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  return {
    year,
    week: Math.floor((thursday.getTime() - jan1.getTime()) / (7 * MS_DAY)) + 1,
  };
}

const MONTHS_LONG = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** The period containing `date`. */
export function periodFor(kind: PeriodKind, date: string): Period {
  if (kind === "WEEK") {
    const start = weekStart(date);
    const end = addDaysIso(start, 6);
    const { year, week } = isoWeek(start);
    return {
      kind,
      start,
      end,
      label: `S${String(week).padStart(2, "0")} ${year}`,
      title: `Semana ${week} de ${year} · ${start} a ${end}`,
      days: 7,
    };
  }
  if (kind === "MONTH") {
    const d = utc(date);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const start = iso(new Date(Date.UTC(y, m, 1)));
    const end = iso(new Date(Date.UTC(y, m + 1, 0)));
    return {
      kind,
      start,
      end,
      label: monthLabel(start),
      title: `${MONTHS_LONG[m]} ${y}`,
      days: daysBetween(start, end) + 1,
    };
  }
  const d = utc(date);
  const y = d.getUTCFullYear();
  const q = quarterOf(d.getUTCMonth());
  const start = iso(new Date(Date.UTC(y, q * 3, 1)));
  const end = iso(new Date(Date.UTC(y, q * 3 + 3, 0)));
  return {
    kind,
    start,
    end,
    label: `Q${q + 1} ${y}`,
    title: `Trimestre ${q + 1} de ${y} · ${MONTHS_LONG[q * 3]} a ${MONTHS_LONG[q * 3 + 2]}`,
    days: daysBetween(start, end) + 1,
  };
}

/**
 * The period `n` steps away.
 *
 * Stepping by calendar unit rather than by a fixed number of days, so a
 * quarter's previous quarter is the previous quarter and not "91 days back",
 * which would drift out of alignment within a year.
 */
export function shiftPeriod(p: Period, n: number): Period {
  if (p.kind === "WEEK") return periodFor("WEEK", addDaysIso(p.start, n * 7));
  const d = utc(p.start);
  const months = p.kind === "MONTH" ? n : n * 3;
  return periodFor(
    p.kind,
    iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))),
  );
}

/**
 * Bucket size inside a period: a weekly report reads day by day, a quarter
 * would be 90 hairlines and reads week by week.
 */
export function bucketKindFor(kind: PeriodKind): "DAY" | "WEEK" {
  return kind === "QUARTER" ? "WEEK" : "DAY";
}

export type Bucket = { key: string; label: string; start: string; end: string };

/** Every bucket in the period, including the empty ones. */
export function bucketsFor(p: Period): Bucket[] {
  const out: Bucket[] = [];
  if (bucketKindFor(p.kind) === "DAY") {
    for (let d = p.start; d <= p.end; d = addDaysIso(d, 1)) {
      out.push({
        key: d,
        // DD/MM: a bare day number repeats across months in a quarter.
        label: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
        start: d,
        end: d,
      });
    }
    return out;
  }
  let cursor = weekStart(p.start);
  while (cursor <= p.end) {
    const end = addDaysIso(cursor, 6);
    out.push({
      key: cursor,
      label: `${cursor.slice(8, 10)}/${cursor.slice(5, 7)}`,
      start: cursor,
      end,
    });
    cursor = addDaysIso(cursor, 7);
  }
  return out;
}
