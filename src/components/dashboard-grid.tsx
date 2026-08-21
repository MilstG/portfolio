import {
  Eye,
  EyeOff,
  GripVertical,
  Columns2,
  Maximize2,
  Square,
  RotateCcw,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pat-dashboard-layout-v4";

export type PanelId =
  | "allocation"
  | "incomeWindow"
  | "insights"
  | "holdings"
  | "nwSeries"
  | "projIncome"
  | "pnlByType"
  | "coupons24"
  | "payCalendar"
  | "bondYields"
  | "amorts"
  | "incomeExpense"
  | "allocTarget"
  | "pnlContrib"
  | "fxExposure"
  | "drawdown"
  | "concentration"
  | "correlation"
  | "fxScenario"
  | "rebalance"
  | "costLadder"
  | "goals"
  | "returns";

/** Column span: 1 = 1 col, 2 = 2 cols, 3 = full width. */
export type PanelSpan = 1 | 2 | 3;

export const PANEL_LABELS: Record<PanelId, string> = {
  allocation: "ALLOCATION",
  incomeWindow: "INCOME WINDOW",
  insights: "INSIGHTS",
  holdings: "HOLDINGS RANK",
  nwSeries: "NW SERIES",
  projIncome: "PROJ INCOME 12M",
  pnlByType: "P&L BY TYPE",
  coupons24: "COUPONS 12M",
  payCalendar: "PAY CALENDAR 24M",
  bondYields: "BOND YIELDS",
  amorts: "AMORTIZATIONS",
  incomeExpense: "INCOME / EXPENSE",
  allocTarget: "ALLOC VS TARGET",
  pnlContrib: "P&L CONTRIBUTION",
  fxExposure: "FX EXPOSURE",
  drawdown: "DRAWDOWN",
  concentration: "HHI / CONCENTRATION",
  correlation: "CLASS MIX",
  fxScenario: "FX STRESS",
  rebalance: "REBALANCE",
  costLadder: "COST LADDER",
  goals: "GOALS",
  returns: "RETORNO ANUAL",
};

export const DEFAULT_LAYOUT: PanelId[] = [
  "allocation",
  "incomeWindow",
  "insights",
  "returns",
  "holdings",
  "nwSeries",
  "projIncome",
  "pnlByType",
  "coupons24",
  "payCalendar",
  "bondYields",
  "amorts",
  "incomeExpense",
  "allocTarget",
  "pnlContrib",
  "fxExposure",
  "drawdown",
  "concentration",
  "correlation",
  "fxScenario",
  "rebalance",
  "costLadder",
  "goals",
];

const DEFAULT_SPANS: Partial<Record<PanelId, PanelSpan>> = {
  returns: 3,
  holdings: 3,
  coupons24: 3,
  payCalendar: 3,
  incomeExpense: 3,
  pnlContrib: 3,
  costLadder: 3,
};

/** Panels off by default: available from the panel menu, but the first-run
 *  dashboard stays readable instead of rendering all 22 at once. */
export const DEFAULT_HIDDEN: PanelId[] = [
  "coupons24",
  "bondYields",
  "amorts",
  "incomeExpense",
  "allocTarget",
  "pnlContrib",
  "drawdown",
  "correlation",
  "fxScenario",
  "rebalance",
  "costLadder",
  "goals",
];

type LayoutState = {
  order: PanelId[];
  hidden: PanelId[];
  spans: Partial<Record<PanelId, PanelSpan>>;
};

function defaultState(): LayoutState {
  return {
    order: [...DEFAULT_LAYOUT],
    hidden: [...DEFAULT_HIDDEN],
    spans: { ...DEFAULT_SPANS },
  };
}

function loadState(): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // migrate v3 (plain array of ids) if present
      const v3 = localStorage.getItem("pat-dashboard-layout-v3");
      if (v3) {
        const parsed = JSON.parse(v3) as string[];
        const known = new Set(DEFAULT_LAYOUT);
        const order = parsed.filter((id): id is PanelId =>
          known.has(id as PanelId),
        );
        for (const id of DEFAULT_LAYOUT)
          if (!order.includes(id)) order.push(id);
        const state = { order, hidden: [], spans: { ...DEFAULT_SPANS } };
        saveState(state);
        return state;
      }
      return defaultState();
    }
    const parsed = JSON.parse(raw) as Partial<LayoutState>;
    const known = new Set(DEFAULT_LAYOUT);
    const order = (parsed.order ?? []).filter((id): id is PanelId =>
      known.has(id as PanelId),
    );
    for (const id of DEFAULT_LAYOUT) if (!order.includes(id)) order.push(id);
    const hidden = (parsed.hidden ?? []).filter((id): id is PanelId =>
      known.has(id as PanelId),
    );
    const spans: Partial<Record<PanelId, PanelSpan>> = { ...DEFAULT_SPANS };
    if (parsed.spans) {
      for (const [k, v] of Object.entries(parsed.spans)) {
        if (known.has(k as PanelId) && (v === 1 || v === 2 || v === 3)) {
          spans[k as PanelId] = v;
        }
      }
    }
    return { order, hidden, spans };
  } catch {
    return defaultState();
  }
}

function saveState(state: LayoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function spanClass(span: PanelSpan): string {
  if (span >= 3) return "col-span-full";
  if (span === 2) return "md:col-span-2";
  return "";
}

function nextSpan(current: PanelSpan): PanelSpan {
  if (current === 1) return 2;
  if (current === 2) return 3;
  return 1;
}

function SpanIcon({ span }: { span: PanelSpan }) {
  if (span >= 3) return <Maximize2 className="size-3" />;
  if (span === 2) return <Columns2 className="size-3" />;
  return <Square className="size-3" />;
}

export function DashboardGrid({
  panels,
}: {
  panels: Partial<Record<PanelId, ReactNode>>;
}) {
  const [state, setState] = useState<LayoutState>(defaultState);
  const [ready, setReady] = useState(false);
  const [dragId, setDragId] = useState<PanelId | null>(null);
  const [overId, setOverId] = useState<PanelId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setState(loadState());
    setReady(true);
  }, []);

  function patch(updater: (prev: LayoutState) => LayoutState) {
    setState((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }

  const visible = useMemo(
    () => state.order.filter((id) => panels[id] && !state.hidden.includes(id)),
    [state.order, state.hidden, panels],
  );

  const hiddenAvailable = useMemo(
    () => state.hidden.filter((id) => panels[id]),
    [state.hidden, panels],
  );

  function onDragStart(e: DragEvent, id: PanelId) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDragOver(e: DragEvent, id: PanelId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== overId) setOverId(id);
  }

  function onDrop(e: DragEvent, target: PanelId) {
    e.preventDefault();
    const source = (e.dataTransfer.getData("text/plain") || dragId) as PanelId;
    setDragId(null);
    setOverId(null);
    if (!source || source === target) return;
    patch((prev) => {
      const next = [...prev.order];
      const from = next.indexOf(source);
      const to = next.indexOf(target);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, source);
      return { ...prev, order: next };
    });
  }

  function hide(id: PanelId) {
    patch((prev) => ({
      ...prev,
      hidden: prev.hidden.includes(id) ? prev.hidden : [...prev.hidden, id],
    }));
  }

  function show(id: PanelId) {
    patch((prev) => ({
      ...prev,
      hidden: prev.hidden.filter((x) => x !== id),
    }));
    setMenuOpen(false);
  }

  function showAll() {
    patch((prev) => ({ ...prev, hidden: [] }));
    setMenuOpen(false);
  }

  function cycleSpan(id: PanelId) {
    patch((prev) => {
      const current = prev.spans[id] ?? 1;
      return { ...prev, spans: { ...prev.spans, [id]: nextSpan(current) } };
    });
  }

  function reset() {
    const next = defaultState();
    setState(next);
    saveState(next);
    setMenuOpen(false);
  }

  if (!ready) {
    // Render the default layout during SSR/first paint; localStorage overrides
    // after hydration. Avoids a blank dashboard while the layout loads.
    return (
      <div className="grid grid-flow-dense grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {DEFAULT_LAYOUT.filter((id) => panels[id]).map((id) => (
          <div key={id} className={spanClass(DEFAULT_SPANS[id] ?? 1)}>
            {panels[id]}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p className="font-mono text-[11px] tracking-widest text-muted">
          DRAG · SIZE · HIDE · {visible.length}/
          {Object.keys(panels).filter((k) => panels[k as PanelId]).length}{" "}
          visible
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-subtle hover:text-accent"
              title="Mostrar paneles ocultos"
            >
              <Eye className="size-3" />
              SHOW
              {hiddenAvailable.length > 0 ? ` (${hiddenAvailable.length})` : ""}
            </button>
            {menuOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Cerrar menú"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] border border-border bg-surface p-1 shadow-none">
                  {hiddenAvailable.length === 0 ? (
                    <p className="px-2 py-1.5 font-mono text-[11px] text-muted">
                      ningún panel oculto
                    </p>
                  ) : (
                    <>
                      {hiddenAvailable.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => show(id)}
                          className="flex w-full items-center gap-2 px-2 py-1 font-mono text-[11px] text-fg hover:bg-raised hover:text-accent"
                        >
                          <Eye className="size-3 shrink-0" />
                          {PANEL_LABELS[id]}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={showAll}
                        className="mt-0.5 flex w-full items-center gap-2 border-t border-line px-2 py-1.5 font-mono text-[11px] text-accent hover:bg-raised"
                      >
                        SHOW ALL
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-subtle hover:text-accent"
            title="Reset layout, sizes y hidden"
          >
            <RotateCcw className="size-3" /> RESET
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-flow-dense grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((id) => {
          const node = panels[id];
          if (!node) return null;
          const span = state.spans[id] ?? 1;
          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => onDragStart(e, id)}
              onDragOver={(e) => onDragOver(e, id)}
              onDrop={(e) => onDrop(e, id)}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={cn(
                "relative group",
                spanClass(span),
                dragId === id && "opacity-50",
                overId === id &&
                  dragId &&
                  dragId !== id &&
                  "ring-1 ring-accent",
              )}
            >
              {/* Panel chrome controls */}
              <div className="absolute top-0 right-7 z-10 flex h-7 items-center gap-0.5 bg-surface pl-1 opacity-60 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleSpan(id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="inline-flex size-5 items-center justify-center text-subtle hover:text-accent"
                  title={`Ancho: ${span === 3 ? "full" : span + " col"} (click para ciclar)`}
                >
                  <SpanIcon span={span} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hide(id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="inline-flex size-5 items-center justify-center text-subtle hover:text-loss"
                  title="Ocultar panel"
                >
                  <EyeOff className="size-3" />
                </button>
                <span
                  className="inline-flex size-5 cursor-grab items-center justify-center text-subtle hover:text-accent active:cursor-grabbing"
                  title="Arrastrar"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <GripVertical className="size-3.5" />
                </span>
              </div>
              {node}
            </div>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="border border-border bg-surface p-4 text-center">
          <p className="font-mono text-xs text-muted">
            Todos los paneles están ocultos.
          </p>
          <button
            type="button"
            onClick={showAll}
            className="mt-2 font-mono text-[11px] text-accent hover:underline"
          >
            SHOW ALL
          </button>
        </div>
      ) : null}
    </div>
  );
}
