import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

/**
 * Click-to-sort for the dashboard tables.
 *
 * HOLDINGS RANK, P&L CONTRIBUTION and COST LADDER were the same list of
 * positions re-sorted three ways, each costing a full-width panel. One sortable
 * table answers all three questions.
 */
export function useSort<
  T,
  A extends Record<string, (row: T) => number | string>,
>(
  rows: T[],
  accessors: A,
  // Keyed off `accessors` rather than a bare string so the column set is
  // inferred from the record instead of collapsing to the initial key.
  initialKey: Extract<keyof A, string>,
  initialDir: SortDir = "desc",
) {
  type K = Extract<keyof A, string>;
  const [key, setKey] = useState<K>(initialKey);
  const [dir, setDir] = useState<SortDir>(initialDir);

  const sorted = useMemo(() => {
    const get = accessors[key];
    const factor = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (typeof x === "string" || typeof y === "string") {
        return String(x).localeCompare(String(y)) * factor;
      }
      return (x - y) * factor;
    });
    // accessors is rebuilt each render by callers; key/dir/rows drive the sort.
  }, [rows, key, dir, accessors]);

  /** Same column toggles direction; a new column starts on its natural side. */
  const toggle = (next: K, naturalDir: SortDir = "desc") => {
    if (next === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setKey(next);
      setDir(naturalDir);
    }
  };

  return { key, dir, sorted, toggle };
}

export function SortHeader<K extends string>({
  label,
  sortKey,
  active,
  dir,
  onSort,
  naturalDir = "desc",
  align = "left",
  className,
}: {
  label: string;
  sortKey: K;
  active: K;
  dir: SortDir;
  onSort: (key: K, naturalDir?: SortDir) => void;
  naturalDir?: SortDir;
  align?: "left" | "right";
  className?: string;
}) {
  const isActive = active === sortKey;
  return (
    <th
      className={cn(
        "py-1 pr-2",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey, naturalDir)}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap hover:text-accent",
          isActive ? "text-accent" : "text-muted",
        )}
      >
        {label}
        <span
          aria-hidden
          className={cn("text-[9px]", isActive ? "opacity-100" : "opacity-0")}
        >
          {dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}
