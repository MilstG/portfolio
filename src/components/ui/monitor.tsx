import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Terminal-style panel used across the Bloomberg dashboard. */
export function Monitor({
  title,
  children,
  className,
  action,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("flex flex-col border border-border bg-surface", className)}>
      <header className="flex h-7 items-center justify-between border-b border-border px-2">
        <h2 className="font-mono text-[10px] tracking-[0.16em] text-accent">{title}</h2>
        {action}
      </header>
      <div className="flex-1 p-2">{children}</div>
    </section>
  );
}
