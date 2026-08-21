import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export const RANGES = ["1M", "3M", "1A", "ALL"] as const;
export type Range = (typeof RANGES)[number];

const MONTHS: Record<Exclude<Range, "ALL">, number> = {
  "1M": 1,
  "3M": 3,
  "1A": 12,
};

/** Earliest ISO date included by a range, or null for ALL. */
export function rangeStart(range: Range, today = new Date()): string | null {
  if (range === "ALL") return null;
  const d = new Date(today.getTime());
  d.setUTCMonth(d.getUTCMonth() - MONTHS[range]);
  return d.toISOString().slice(0, 10);
}

/**
 * Windowing for any dated series. Always keeps at least two points so a short
 * range never collapses the chart into the degenerate single-point rendering.
 */
export function useRange<T extends { date: string }>(
  points: T[],
  initial: Range = "ALL",
) {
  const [range, setRange] = useState<Range>(initial);
  const slice = useMemo(() => {
    const start = rangeStart(range);
    if (!start) return points;
    const windowed = points.filter((p) => p.date >= start);
    return windowed.length >= 2 ? windowed : points.slice(-2);
  }, [points, range]);
  return { range, setRange, slice };
}

export function RangeSelect({
  value,
  onChange,
  className,
}: {
  value: Range;
  onChange: (r: Range) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-stretch", className)} role="group">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={value === r}
          onClick={() => onChange(r)}
          className={cn(
            "border px-1.5 py-0.5 font-mono text-[10px] tracking-widest",
            value === r
              ? "border-accent bg-accent text-accent-fg"
              : "border-border text-subtle hover:border-accent hover:text-accent",
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
