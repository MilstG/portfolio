import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Terminal-style panel used across the dashboard and every page. */
export function Monitor({
  title,
  children,
  className,
  bodyClassName,
  action,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col border border-border bg-surface",
        className,
      )}
    >
      <header className="flex h-7 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
        <h2 className="min-w-0 truncate font-mono text-[12px] tracking-[0.16em] whitespace-nowrap text-accent">
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
  return (
    <span className="inline-flex size-4 items-center justify-center border border-line font-mono text-[11px] text-subtle">
      ?
    </span>
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
