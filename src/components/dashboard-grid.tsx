import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pat-dashboard-layout-v1";

export type PanelId =
  | "kpis"
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
  | "costLadder";

export const DEFAULT_LAYOUT: PanelId[] = [
  "kpis",
  "allocation",
  "incomeWindow",
  "insights",
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
];

export const PANEL_SPAN: Partial<Record<PanelId, string>> = {
  kpis: "col-span-full",
  holdings: "col-span-full",
  coupons24: "col-span-full md:col-span-2",
  payCalendar: "col-span-full md:col-span-2",
  incomeExpense: "col-span-full md:col-span-2",
  pnlContrib: "col-span-full md:col-span-2",
  costLadder: "col-span-full md:col-span-2",
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
    /* ignore */
  }
}

function SortablePanel({
  id,
  children,
  className,
}: {
  id: PanelId;
  children: ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative", isDragging && "z-20 opacity-90 ring-1 ring-accent", className)}
    >
      <button
        type="button"
        className="absolute right-1 top-1 z-10 inline-flex h-5 w-5 items-center justify-center text-subtle hover:text-accent"
        aria-label="Arrastrar panel"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      {children}
    </div>
  );
}

export function DashboardGrid({ panels }: { panels: Record<PanelId, ReactNode> }) {
  const [order, setOrder] = useState<PanelId[]>(DEFAULT_LAYOUT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOrder(loadLayout());
    setReady(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((items) => {
      const oldIndex = items.indexOf(active.id as PanelId);
      const newIndex = items.indexOf(over.id as PanelId);
      const next = arrayMove(items, oldIndex, newIndex);
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
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-widest text-muted">
          DRAG · reordená paneles · se guarda local
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 font-mono text-[10px] text-subtle hover:text-accent"
        >
          <RotateCcw className="size-3" /> RESET LAYOUT
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {order.map((id) => {
              const node = panels[id];
              if (!node) return null;
              return (
                <SortablePanel key={id} id={id} className={PANEL_SPAN[id]}>
                  {node}
                </SortablePanel>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
