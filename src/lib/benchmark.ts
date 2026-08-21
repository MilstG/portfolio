import type { FxHistoryRow, Snapshot } from "@/lib/types";

export type BenchmarkPoint = {
  date: string;
  label: string;
  /** Net worth indexed to 100 at the start of the window. */
  nw: number;
  /** Blue dollar indexed to 100 over the same window. */
  blue: number;
  /** MEP indexed to 100 over the same window. */
  mep: number;
};

export type Benchmark = {
  points: BenchmarkPoint[];
  /** Total change over the window, as decimals. */
  nwChange: number;
  blueChange: number;
  mepChange: number;
  from: string;
  to: string;
};

/** Latest row at or before `date`, assuming `rows` is sorted ascending. */
function asOf<T extends { date: string }>(rows: T[], date: string): T | null {
  let found: T | null = null;
  for (const r of rows) {
    if (r.date > date) break;
    found = r;
  }
  return found;
}

/**
 * Net worth against the peso, both rebased to 100.
 *
 * The book is already valued in USD, so this answers the question an
 * ARS-exposed holder actually asks: did the portfolio grow faster than the
 * currency moved?
 *
 * Returns null when the two series don't overlap on at least two dates —
 * fx_history only gains a row on the days FX is updated, so a fresh install has
 * nothing to compare and gets an explanation instead of a misleading flat line.
 */
export function computeBenchmark(
  snapshots: Snapshot[],
  fxHistory: FxHistoryRow[],
): Benchmark | null {
  const snaps = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const fx = [...fxHistory].sort((a, b) => a.date.localeCompare(b.date));
  if (snaps.length < 2 || fx.length < 1) return null;

  const start = fx[0].date;
  const usable = snaps.filter((s) => s.date >= start && s.totalUsd > 0);
  if (usable.length < 2) return null;

  const baseFx = asOf(fx, usable[0].date) ?? fx[0];
  const baseNw = usable[0].totalUsd;
  if (!baseNw || !baseFx.blue || !baseFx.mep) return null;

  const points: BenchmarkPoint[] = usable.map((s) => {
    const row = asOf(fx, s.date) ?? baseFx;
    return {
      date: s.date,
      label: s.date.slice(5, 7) + "/" + s.date.slice(2, 4),
      nw: (s.totalUsd / baseNw) * 100,
      blue: (row.blue / baseFx.blue) * 100,
      mep: (row.mep / baseFx.mep) * 100,
    };
  });

  const last = points[points.length - 1];
  return {
    points,
    nwChange: last.nw / 100 - 1,
    blueChange: last.blue / 100 - 1,
    mepChange: last.mep / 100 - 1,
    from: points[0].date,
    to: last.date,
  };
}
