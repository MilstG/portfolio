import type { ReactNode } from "react";
import { useHints } from "@/components/ui/hints";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

/** Terminal-style panel used across the dashboard and every page. */
export function Monitor({
  title,
  children,
  className,
  bodyClassName,
  action,
  emphasis = "default",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  action?: ReactNode;
  /** "primary" panels carry the headline numbers and are given more weight so
   *  the grid reads as a hierarchy instead of twenty-two equal boxes. */
  emphasis?: "primary" | "default";
}) {
  const primary = emphasis === "primary";
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col border bg-surface",
        primary ? "border-line" : "border-border",
        className,
      )}
    >
      <header
        className={cn(
          "flex h-7 shrink-0 items-center justify-between gap-2 border-b px-2",
          primary ? "border-line bg-raised/60" : "border-border",
        )}
      >
        <h2
          className={cn(
            "min-w-0 truncate font-mono tracking-[0.16em] whitespace-nowrap",
            primary
              ? "text-[13px] font-medium text-accent"
              : "text-[12px] text-muted",
          )}
        >
          {title}
        </h2>
        {action ? (
          <div className="flex shrink-0 items-center gap-1">{action}</div>
        ) : null}
      </header>
      <div className={cn("min-w-0 flex-1 p-2", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small "?" trigger for a Tip inside a Monitor header. */
export function Hint() {
  const { on } = useHints();
  if (!on) return null;
  return (
    <span className="inline-flex size-4 items-center justify-center border border-line font-mono text-[11px] text-subtle">
      ?
    </span>
  );
}

/**
 * The "?" and its explanation as one unit.
 *
 * Wrapping a hidden <Hint /> in a <Tip> left an empty tooltip trigger in the
 * header whenever hints were off — a hoverable span with nothing in it. This
 * drops the whole thing instead.
 */
export function HelpTip({ content }: { content: ReactNode }) {
  const { on } = useHints();
  if (!on || !content) return null;
  return (
    <Tip inline content={content}>
      <span className="inline-flex size-4 items-center justify-center border border-line font-mono text-[11px] text-subtle">
        ?
      </span>
    </Tip>
  );
}

/** Page title row: H1 + optional meta + right-aligned actions. */
export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-mono text-sm tracking-widest text-accent">
          {title}
        </h1>
        {meta}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

/** Horizontal-scroll wrapper so wide tables never stretch the page on mobile. */
export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("-mx-2 overflow-x-auto px-2", className)}>
      {children}
    </div>
  );
}
