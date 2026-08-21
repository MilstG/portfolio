import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Briefcase,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  CommandPalette,
  openCommandPalette,
} from "@/components/ui/command-palette";
import { useHints } from "@/components/ui/hints";
import { logout } from "@/lib/server/auth";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "MONIT", key: "F1", icon: LayoutDashboard },
  { to: "/assets", label: "POS", key: "F2", icon: Briefcase },
  { to: "/cash", label: "CASH", key: "F3", icon: Wallet },
  { to: "/cashflow", label: "FLUJO", key: "F4", icon: ArrowLeftRight },
  { to: "/settings", label: "CFG", key: "F5", icon: Settings },
] as const;

function useClock() {
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
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

export function Shell({
  children,
  pinEnabled,
}: {
  children: ReactNode;
  pinEnabled: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const clock = useClock();
  const hints = useHints();
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <div className="flex min-h-dvh flex-col bg-bg font-sans text-fg">
      <header className="flex h-9 items-center justify-between border-b border-accent bg-bg px-3">
        <Link to="/" className="flex items-center gap-3">
          <span className="bg-accent px-2 font-mono text-xs font-semibold tracking-widest text-accent-fg">
            PAT
          </span>
          <span className="font-mono text-xs tracking-widest text-accent">
            PATRIMONIO
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span
            className="hidden font-mono text-[12px] tabular-nums text-muted sm:inline"
            suppressHydrationWarning
          >
            {clock}
          </span>
          <button
            type="button"
            aria-label="Comandos"
            title="Comandos (Ctrl/Cmd+K)"
            className="inline-flex h-6 items-center gap-1.5 border border-border px-2 font-mono text-[11px] text-muted hover:border-accent hover:text-accent"
            onClick={openCommandPalette}
          >
            <Search className="size-3" />
            <span className="hidden tracking-widest sm:inline">⌘K</span>
          </button>
          <button
            type="button"
            aria-label={hints.on ? "Ocultar ayudas" : "Mostrar ayudas"}
            aria-pressed={hints.on}
            title={hints.on ? "Ocultar ayudas" : "Mostrar ayudas"}
            className={cn(
              "inline-flex size-6 items-center justify-center",
              hints.on ? "text-accent" : "text-muted hover:text-accent",
            )}
            onClick={hints.toggle}
          >
            <HelpCircle className="size-3.5" />
          </button>
          {pinEnabled ? (
            <button
              type="button"
              aria-label="Bloquear"
              title="Bloquear"
              className="inline-flex size-6 items-center justify-center text-muted hover:text-accent"
              onClick={async () => {
                await logout();
                window.location.assign("/login");
              }}
            >
              <LogOut className="size-3.5" />
            </button>
          ) : null}
        </div>
      </header>

      {/* Desktop: Bloomberg-style function-key tabs */}
      <nav className="hidden h-8 items-stretch border-b border-border bg-surface md:flex">
        {nav.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex h-8 min-w-16 items-center gap-1.5 border-r border-border px-3 font-mono text-[12px] tracking-wide",
                active
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-raised hover:text-fg",
              )}
            >
              <span
                className={cn(
                  "text-[11px]",
                  active ? "text-accent-fg/70" : "text-subtle",
                )}
              >
                {item.key}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 px-3 py-3 pb-20 md:px-4 md:pb-10">
        {children}
      </main>

      <footer className="hidden h-6 items-center justify-between border-t border-border bg-surface px-3 font-mono text-[11px] tracking-wide text-subtle md:flex">
        <span>{"PAT <GO>"}</span>
        <span className="text-accent">LIVE</span>
        <span>USD BOOK</span>
      </footer>

      <CommandPalette pinEnabled={pinEnabled} />

      {/* Mobile: bottom tab bar (the only nav below md) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-accent bg-bg pb-[env(safe-area-inset-bottom)] md:hidden">
        {nav.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 font-mono text-[11px] tracking-wide",
                active ? "bg-accent text-accent-fg" : "text-muted",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
