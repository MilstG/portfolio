import { GripVertical, RotateCcw } from "lucide-react";
import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pat-dashboard-layout-v2";

export type PanelId =
  | "allocation"
  | "incomeWindow"
  | "insights"
  | "holdings"
  | "nwSeries"
  | "projIncome"
  | "pnlByType";

export const DEFAULT_LAYOUT: PanelId[] = [
  "allocation",
  "incomeWindow",
  "insights",
  "holdings",
  "nwSeries",
  "projIncome",
  "pnlByType",
];

/** Full-width panels */
const FULL: Partial<Record<PanelId, boolean>> = {
  holdings: true,
};

function loadLayout(): PanelId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as string[];
    const known = new Set(DEFAULT_LAYOUT);
    const filtered = parsed.filter((id): id is PanelId => known.has(id as PanelId));
    for (const id of DEFAULT_LAYOUT) {
      if (!filtered.includes(id)) filtered.push(id);
    }
    return filtered;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(ids: PanelId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
}

/** Native HTML5 DnD grid. Order persists in localStorage. */
export function DashboardGrid({ panels }: { panels: Record<PanelId, ReactNode> }) {
  const [order, setOrder] = useState<PanelId[]>(DEFAULT_LAYOUT);
  const [ready, setReady] = useState(false);
  const [dragId, setDragId] = useState<PanelId | null>(null);
  const [overId, setOverId] = useState<PanelId | null>(null);

  useEffect(() => {
    setOrder(loadLayout());
    setReady(true);
  }, []);

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
    setOrder((items) => {
      const next = [...items];
      const from = next.indexOf(source);
      const to = next.indexOf(target);
      if (from < 0 || to < 0) return items;
      next.splice(from, 1);
      next.splice(to, 0, source);
      saveLayout(next);
      return next;
    });
  }

  function reset() {
    setOrder(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
  }

  if (!ready) {
    return <div className="font-mono text-xs text-muted">Cargando layout…</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <p className="font-mono text-[10px] tracking-widest text-muted">
          DRAG · reordená paneles · se guarda en este browser
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 font-mono text-[10px] text-subtle hover:text-accent"
        >
          <RotateCcw className="size-3" /> RESET
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {order.map((id) => {
          const node = panels[id];
          if (!node) return null;
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
                "relative",
                FULL[id] && "col-span-full",
                dragId === id && "opacity-50",
                overId === id && dragId && dragId !== id && "ring-1 ring-accent",
              )}
            >
              <span
                className="absolute right-1.5 top-1.5 z-10 cursor-grab text-subtle hover:text-accent active:cursor-grabbing"
                title="Arrastrar para reordenar"
              >
                <GripVertical className="size-3.5" />
              </span>
              {node}
            </div>
          );
        })}
      </div>
    </div>
  );
}
