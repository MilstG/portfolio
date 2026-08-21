import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "MONIT", key: "F1" },
  { to: "/assets", label: "POS", key: "F2" },
  { to: "/cash", label: "CASH", key: "F3" },
  { to: "/cashflow", label: "FLUJO", key: "F4" },
  { to: "/settings", label: "FX", key: "F5" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date()
          .toLocaleString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "short",
            hour12: false,
          })
          .toUpperCase(),
      );
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-bg font-sans text-fg">
      <header className="flex h-8 items-center justify-between border-b border-accent bg-bg px-3">
        <div className="flex items-center gap-3">
          <span className="bg-accent px-2 font-mono text-xs font-semibold tracking-widest text-accent-fg">
            PAT
          </span>
          <span className="font-mono text-xs tracking-widest text-accent">PATRIMONIO</span>
        </div>
        <span className="font-mono text-[11px] text-muted">{clock}</span>
      </header>

      <nav className="flex h-8 items-stretch overflow-x-auto border-b border-border bg-surface">
        {nav.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex h-8 min-w-16 items-center gap-1.5 border-r border-border px-3 font-mono text-[11px] tracking-wide",
                active ? "bg-accent text-accent-fg" : "text-muted hover:bg-raised hover:text-fg",
              )}
            >
              <span className={cn("text-[10px]", active ? "text-accent-fg/70" : "text-subtle")}>
                {item.key}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 px-3 py-3 pb-16 md:px-4 md:pb-10">{children}</main>

      <footer className="hidden h-6 items-center justify-between border-t border-border bg-surface px-3 font-mono text-[10px] tracking-wide text-subtle md:flex">
        <span>{"PAT <GO>"}</span>
        <span className="text-accent">LIVE</span>
        <span>USD BOOK</span>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-accent bg-bg pb-[env(safe-area-inset-bottom)] md:hidden">
        {nav.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center font-mono text-[10px] tracking-wide",
                active ? "bg-accent text-accent-fg" : "text-muted",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
