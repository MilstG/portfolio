import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

/**
 * An asset name that goes somewhere.
 *
 * Every dashboard table lists positions that have a detail page, and none of
 * them linked to it. The hover tip carries the numbers the row had no column
 * for, so a row answers a question without a navigation.
 */
export function AssetLink({
  id,
  name,
  ticker,
  tip,
  className,
}: {
  id: string;
  name: string;
  ticker?: string | null;
  tip?: ReactNode;
  className?: string;
}) {
  const link = (
    <Link
      to="/assets/$id"
      params={{ id }}
      className={cn(
        // A dotted rule at rest so the row reads as navigable without hovering
        // it; solid accent on hover.
        "truncate text-fg underline decoration-line decoration-dotted underline-offset-[3px]",
        "hover:text-accent hover:decoration-accent hover:decoration-solid",
        className,
      )}
    >
      {name}
      {ticker && ticker !== name ? (
        <span className="ml-1 text-subtle">{ticker}</span>
      ) : null}
    </Link>
  );
  if (!tip) return link;
  return (
    <Tip inline content={tip}>
      {link}
    </Tip>
  );
}

/** Label + value line for building tooltip bodies. */
export function TipRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "gain" | "loss" | "muted";
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-subtle">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-loss",
          tone === "muted" && "text-muted",
        )}
      >
        {value}
      </span>
    </div>
  );
}
