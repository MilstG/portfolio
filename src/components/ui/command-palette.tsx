import { useRouter } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Briefcase,
  Camera,
  HelpCircle,
  LayoutDashboard,
  LockKeyhole,
  RefreshCw,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useHints } from "@/components/ui/hints";
import { logout } from "@/lib/server/auth";
import { refreshPrices, snapshotNow } from "@/lib/server/portfolio";
import { cn } from "@/lib/utils";

/** Lets the header button toggle the palette without faking a keyboard event. */
export const PALETTE_EVENT = "pat:command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(PALETTE_EVENT));
}

type Command = {
  id: string;
  label: string;
  group: "IR A" | "ACCIÓN";
  hint?: string;
  icon: LucideIcon;
  run: () => void | Promise<void>;
};

export function CommandPalette({ pinEnabled }: { pinEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const hints = useHints();

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => router.navigate({ to });
    const list: Command[] = [
      { id: "nav-/", label: "MONIT", group: "IR A", hint: "F1", icon: LayoutDashboard, run: go("/") },
      { id: "nav-/assets", label: "POS", group: "IR A", hint: "F2", icon: Briefcase, run: go("/assets") },
      { id: "nav-/cash", label: "CASH", group: "IR A", hint: "F3", icon: Wallet, run: go("/cash") },
      { id: "nav-/cashflow", label: "FLUJO", group: "IR A", hint: "F4", icon: ArrowLeftRight, run: go("/cashflow") },
      { id: "nav-/settings", label: "CFG", group: "IR A", hint: "F5", icon: Settings, run: go("/settings") },
      {
        id: "act-refresh",
        label: "ACTUALIZAR PRECIOS",
        group: "ACCIÓN",
        icon: RefreshCw,
        run: async () => {
          setBusy(true);
          try {
            const r = await refreshPrices();
            await router.invalidate();
            // Per-source counts: an upstream that is down should not look
            // like "nothing changed".
            const parts = [
              r.cryptoWanted ? `crypto ${r.crypto}/${r.cryptoWanted}` : null,
              r.stocksWanted ? `acciones ${r.stocks}/${r.stocksWanted}` : null,
              r.bondsWanted ? `bonos ${r.bonds}/${r.bondsWanted}` : null,
              r.fx ? "FX ok" : "FX sin datos",
            ].filter(Boolean);
            const failed =
              r.crypto < r.cryptoWanted ||
              r.stocks < r.stocksWanted ||
              r.bonds < r.bondsWanted ||
              !r.fx;
            const msg = `${r.updated} activo(s) · ${parts.join(" · ")}`;
            if (failed) toast.warning(msg);
            else toast.success(msg);
          } catch {
            toast.error("No se pudieron actualizar los precios");
          } finally {
            setBusy(false);
          }
        },
      },
      {
        id: "act-snapshot",
        label: "TOMAR SNAPSHOT",
        group: "ACCIÓN",
        icon: Camera,
        run: async () => {
          setBusy(true);
          try {
            await snapshotNow();
            await router.invalidate();
            toast.success("Snapshot guardado");
          } catch {
            toast.error("No se pudo guardar el snapshot");
          } finally {
            setBusy(false);
          }
        },
      },
      {
        id: "act-hints",
        label: hints.on ? "OCULTAR AYUDAS" : "MOSTRAR AYUDAS",
        group: "ACCIÓN",
        icon: HelpCircle,
        run: () => hints.toggle(),
      },
    ];
    if (pinEnabled) {
      list.push({
        id: "act-lock",
        label: "BLOQUEAR",
        group: "ACCIÓN",
        icon: LockKeyhole,
        run: async () => {
          await logout();
          window.location.assign("/login");
        },
      });
    }
    return list;
  }, [router, hints, pinEnabled]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  // Global shortcuts: Cmd/Ctrl+K opens the palette, F1-F5 jump straight to a
  // page. The function-key labels have been in the nav all along without
  // anything listening for them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      const fn = /^F([1-5])$/.exec(e.key);
      if (fn && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const to = ["/", "/assets", "/cash", "/cashflow", "/settings"][
          Number(fn[1]) - 1
        ];
        setOpen(false);
        void router.navigate({ to });
      }
    };
    const onOpen = () => setOpen((v) => !v);
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, onOpen);
    };
  }, [router]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      // focus after the dialog paints
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  const runAt = async (i: number) => {
    const cmd = results[i];
    if (!cmd) return;
    setOpen(false);
    await cmd.run();
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % Math.max(1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void runAt(cursor);
    }
  };

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh]"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-lg border border-accent bg-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <span className="font-mono text-[12px] text-accent">{">"}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="comando o página…"
            className="h-10 w-full bg-transparent font-mono text-[13px] text-fg outline-none placeholder:text-subtle"
          />
          <span className="shrink-0 font-mono text-[10px] tracking-widest text-subtle">
            ESC
          </span>
        </div>

        <ul className="max-h-[52vh] overflow-auto py-1">
          {results.length === 0 ? (
            <li className="px-3 py-2 font-mono text-[12px] text-muted">
              sin resultados
            </li>
          ) : (
            results.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null;
              lastGroup = c.group;
              const Icon = c.icon;
              return (
                <li key={c.id}>
                  {header ? (
                    <p className="px-3 pt-2 pb-1 font-mono text-[10px] tracking-widest text-subtle">
                      {header}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => void runAt(i)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[13px]",
                      i === cursor
                        ? "bg-accent text-accent-fg"
                        : "text-fg hover:bg-raised",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.hint ? (
                      <span
                        className={cn(
                          "shrink-0 text-[10px] tracking-widest",
                          i === cursor ? "text-accent-fg/70" : "text-subtle",
                        )}
                      >
                        {c.hint}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
