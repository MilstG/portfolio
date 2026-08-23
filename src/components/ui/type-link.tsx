import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Tip } from "@/components/ui/tip";
import { ASSET_TYPES, cn } from "@/lib/utils";

const TYPE_VALUES = new Set<string>(ASSET_TYPES.map((t) => t.value));

/**
 * An asset class that goes to its own tab.
 *
 * Every class-level panel on the dashboard — the allocation donut, P&L by type,
 * alloc vs target — names a bucket the POS page can already filter to, and none
 * of them led there. Clicking a slice now opens exactly the positions that
 * slice was measuring.
 *
 * Cash is the exception: it is in the allocation total but it is not a
 * position, so it goes to the accounts page instead of a POS filter that would
 * come back empty. A key with no destination renders as plain text rather than
 * a link that lies.
 */
export function TypeLink({
  type,
  label,
  className,
  tip,
}: {
  /** Bucket key: an ASSET_TYPES value, or "CASH". */
  type: string;
  label?: ReactNode;
  className?: string;
  tip?: ReactNode;
}) {
  const body = label ?? type;
  const style = cn(
    "truncate underline decoration-line decoration-dotted underline-offset-[3px]",
    "hover:text-accent hover:decoration-accent hover:decoration-solid",
    className,
  );

  let node: ReactNode;
  if (type === "CASH") {
    node = (
      <Link to="/cash" className={style}>
        {body}
      </Link>
    );
  } else if (TYPE_VALUES.has(type)) {
    node = (
      <Link to="/assets" search={{ type }} className={style}>
        {body}
      </Link>
    );
  } else {
    return <span className={cn("truncate", className)}>{body}</span>;
  }

  if (!tip) return node;
  return (
    <Tip inline content={tip}>
      {node}
    </Tip>
  );
}
