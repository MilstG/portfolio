import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AssetForm } from "@/components/asset-form";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  HelpTip,
  Monitor,
  PageHeader,
  TableWrap,
} from "@/components/ui/monitor";
import { Pager, usePager } from "@/components/ui/pager";
import { Tip } from "@/components/ui/tip";
import { TipRow } from "@/components/ui/asset-link";
import { Button } from "@/components/ui/button";
import { deleteAsset, getPortfolio, upsertAsset } from "@/lib/server/portfolio";
import {
  categoryPies,
  flowProjection,
  formatUnitPrice,
  positionRows,
  positionStats,
  type CategoryPie,
  type FlowProjection,
  type PositionRow,
} from "@/lib/positions";
import type { Asset } from "@/lib/types";
import { assetReturns } from "@/lib/returns";
import { projectCashflow } from "@/lib/portfolio-math";
import { ASSET_TYPES, formatPct, formatUsd, monthLabel } from "@/lib/utils";

const TYPE_VALUES = ASSET_TYPES.map((t) => t.value) as readonly string[];
const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ASSET_TYPES.map((t) => [t.value, t.label]),
);

/**
 * Extends the dashboard's six-colour ramp (COLORS in routes/index.tsx) with six
 * more: a class holding thirteen bonds would otherwise repeat a colour inside a
 * single donut, making two different positions look like one. Still no accent
 * orange and no P&L green or red — those already mean something else.
 */
const SLICE_COLORS = [
  "#4aa3ff",
  "#a78bfa",
  "#f5d565",
  "#2dd4bf",
  "#f472b6",
  "#94a3b8",
  "#60a5fa",
  "#c4b5fd",
  "#fbbf24",
  "#5eead4",
  "#fb7185",
  "#cbd5e1",
];

const CHART_TIP = {
  background: "#000",
  border: "1px solid #ff6d00",
  borderRadius: 0,
  fontSize: 11,
  fontFamily: "IBM Plex Mono",
  padding: "6px 8px",
};

export const Route = createFileRoute("/assets")({
  /**
   * The active class lives in the URL rather than in component state, so the
   * dashboard can link straight to a class and the view is shareable and
   * survives a reload. An unknown value falls back to everything instead of
   * showing an empty table for a typo.
   */
  validateSearch: (search: Record<string, unknown>): { type?: string } => {
    const raw = String(search.type ?? "").toUpperCase();
    return TYPE_VALUES.includes(raw) ? { type: raw } : {};
  },
  loader: () => getPortfolio(),
  component: AssetsPage,
});

function AssetsPage() {
  const data = Route.useLoaderData();
  const { type } = Route.useSearch();
  const router = useRouter();
  const [editing, setEditing] = useState<Asset | null | "new">(null);
  const [pending, setPending] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const filter = type ?? "ALL";

  const fx = data.fx.average;

  // Rent and coupons already collected per position, plus what each is
  // contracted to pay: appreciation alone says a flat that paid two years of
  // rent did nothing.
  const projected = useMemo(
    () =>
      projectCashflow(
        data.recurring,
        data.transactions,
        fx,
        12,
        data.liabilities,
      ),
    [data.recurring, data.transactions, fx, data.liabilities],
  );
  const income = useMemo(() => {
    const projectedByAsset = new Map<string, number>();
    for (const e of projected) {
      if (!e.assetId || e.amountUsd <= 0) continue;
      projectedByAsset.set(
        e.assetId,
        (projectedByAsset.get(e.assetId) ?? 0) + e.amountUsd,
      );
    }
    const map = new Map<
      string,
      { incomeUsd: number; projectedIncomeUsd: number }
    >();
    for (const r of assetReturns(
      data.assets,
      data.transactions,
      fx,
      undefined,
      projectedByAsset,
    )) {
      map.set(r.id, {
        incomeUsd: r.incomeUsd,
        projectedIncomeUsd: r.projectedIncomeUsd,
      });
    }
    return map;
  }, [data.assets, data.transactions, fx, projected]);

  const rows = useMemo(() => {
    const all = positionRows(data.assets, fx, TYPE_LABELS, income);
    return filter === "ALL" ? all : all.filter((r) => r.asset.type === filter);
  }, [data.assets, fx, filter, income]);

  const stats = useMemo(() => positionStats(rows), [rows]);
  const pies = useMemo(() => categoryPies(rows), [rows]);
  const flows = useMemo(
    () =>
      flowProjection(
        projected,
        new Set(rows.map((r) => r.asset.id)),
        monthLabel,
        rows.reduce((s, r) => s + r.valueUsd, 0),
      ),
    [projected, rows],
  );

  const pager = usePager(rows, 25);
  const totalUsd = stats.valueUsd;

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="POS"
        meta={
          <>
            <p className="font-mono text-xs tabular-nums text-fg">
              {formatUsd(totalUsd)}
            </p>
            <p className="font-mono text-[11px] text-muted">
              {rows.length} POSICIONES
              {filter === "ALL" ? "" : ` · ${TYPE_LABELS[filter] ?? filter}`}
            </p>
          </>
        }
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-3.5" /> ADD
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1">
        {[{ value: "ALL", label: "ALL" }, ...ASSET_TYPES].map((f) => (
          <Link
            key={f.value}
            to="/assets"
            // Dropping the param entirely for ALL keeps the bare URL clean.
            search={f.value === "ALL" ? {} : { type: f.value }}
            className={`border px-2 py-1 font-mono text-[11px] tracking-widest ${
              filter === f.value
                ? "border-accent text-accent"
                : "border-border text-muted hover:text-fg"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Monitor title="POSITIONS" bodyClassName="p-0">
        <TableWrap className="mx-0 px-0">
          <table className="w-full font-mono text-[12px] md:min-w-[960px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-widest text-accent">
                <th className="px-2 py-1.5">NAME</th>
                <th className="hidden px-2 py-1.5 xl:table-cell">TYPE</th>
                <th className="hidden px-2 py-1.5 text-right lg:table-cell">
                  QTY
                </th>
                <th className="hidden px-2 py-1.5 text-right lg:table-cell">
                  P.COMPRA
                </th>
                <th className="hidden px-2 py-1.5 text-right md:table-cell">
                  P.ACTUAL
                </th>
                <th className="hidden px-2 py-1.5 text-right xl:table-cell">
                  COST
                </th>
                <th className="px-2 py-1.5 text-right">VALUE</th>
                <th className="hidden px-2 py-1.5 text-right lg:table-cell">
                  RENTA
                </th>
                <th className="px-2 py-1.5 text-right">P&L</th>
                <th className="px-2 py-1.5 text-right">TOTAL</th>
                <th className="hidden px-2 py-1.5 text-right sm:table-cell">
                  WGT
                </th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {pager.slice.map((r) => {
                const a = r.asset;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-border/50 hover:bg-raised/40"
                  >
                    <td className="px-2 py-1.5">
                      <Link
                        to="/assets/$id"
                        params={{ id: a.id }}
                        className="text-fg hover:text-accent"
                      >
                        {a.name}
                        {a.ticker ? (
                          <span className="ml-1 text-subtle">{a.ticker}</span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="hidden px-2 py-1.5 text-muted xl:table-cell">
                      {r.typeLabel}
                    </td>
                    <td className="hidden px-2 py-1.5 text-right tabular-nums text-muted lg:table-cell">
                      {r.quantity != null
                        ? r.quantity.toLocaleString("es-AR")
                        : "—"}
                    </td>
                    <td className="hidden px-2 py-1.5 text-right tabular-nums text-muted lg:table-cell">
                      <PriceCell row={r} price={r.buyPrice} kind="buy" />
                    </td>
                    <td className="hidden px-2 py-1.5 text-right tabular-nums md:table-cell">
                      <PriceCell row={r} price={r.nowPrice} kind="now" />
                    </td>
                    <td className="hidden px-2 py-1.5 text-right tabular-nums text-muted xl:table-cell">
                      {formatUsd(r.costUsd)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatUsd(r.valueUsd)}
                      {r.unpriced ? (
                        <span
                          className="ml-1 text-[10px] tracking-wide text-loss"
                          title="No se pudo traer el precio: se muestra el costo. Revisá el ticker."
                        >
                          SIN PRECIO
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden px-2 py-1.5 text-right tabular-nums lg:table-cell">
                      {r.incomeUsd > 0 || r.projectedIncomeUsd > 0 ? (
                        <Tip
                          inline
                          content={
                            <div className="space-y-0.5">
                              <p className="mb-1 border-b border-line pb-1 text-accent">
                                RENTA
                              </p>
                              <TipRow
                                label="cobrado"
                                value={formatUsd(r.incomeUsd)}
                                tone="gain"
                              />
                              <TipRow
                                label="agendado 12M"
                                value={formatUsd(r.projectedIncomeUsd)}
                                tone="muted"
                              />
                              <p className="mt-1 border-t border-line pt-1 text-subtle">
                                Cobrado desde la compra. No entra en P&L, que es
                                sólo precio; los dos juntos son TOTAL.
                              </p>
                            </div>
                          }
                        >
                          <span
                            className={
                              r.incomeUsd > 0 ? "text-gain" : "text-subtle"
                            }
                          >
                            {r.incomeUsd > 0 ? formatUsd(r.incomeUsd) : "—"}
                          </span>
                        </Tip>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums ${r.pnlUsd >= 0 ? "text-gain" : "text-loss"}`}
                      title="Sólo precio: valor actual contra costo. No incluye alquileres ni cupones cobrados."
                    >
                      {formatUsd(r.pnlUsd)}
                      <span className="block text-[11px] opacity-80 sm:ml-1 sm:inline">
                        {formatPct(r.pnlPct)}
                      </span>
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums ${r.totalUsd >= 0 ? "text-gain" : "text-loss"}`}
                      title="Precio más renta cobrada: lo que la posición realmente rindió."
                    >
                      {formatUsd(r.totalUsd)}
                      <span className="block text-[11px] opacity-80 sm:ml-1 sm:inline">
                        {r.totalPct == null ? "—" : formatPct(r.totalPct)}
                      </span>
                    </td>
                    <td className="hidden px-2 py-1.5 text-right tabular-nums text-subtle sm:table-cell">
                      {totalUsd > 0
                        ? ((r.valueUsd / totalUsd) * 100).toFixed(1)
                        : 0}
                      %
                    </td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Editar"
                        onClick={() => setEditing(a)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Eliminar"
                        onClick={() => setDelId(a.id)}
                      >
                        <Trash2 className="size-3.5 text-loss" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-2 py-10 text-center text-muted"
                  >
                    Sin activos
                    {filter === "ALL"
                      ? ""
                      : ` en ${TYPE_LABELS[filter] ?? filter}`}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
        <div className="px-2 pb-1">
          <Pager
            page={pager.page}
            totalPages={pager.totalPages}
            total={pager.total}
            from={pager.from}
            to={pager.to}
            onChange={pager.setPage}
          />
        </div>
      </Monitor>

      {rows.length > 0 ? (
        <>
          <Breakdown filter={filter} pies={pies} stats={stats} />
          {flows.eventCount > 0 ? (
            <FlowsPanel flows={flows} filter={filter} />
          ) : null}
        </>
      ) : null}

      {editing !== null ? (
        <AssetForm
          key={editing === "new" ? "new" : editing.id}
          open
          initial={editing === "new" ? null : editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            setPending(true);
            try {
              await upsertAsset({ data: payload });
              toast.success("Activo guardado");
              setEditing(null);
              await router.invalidate();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Error");
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}

      <ConfirmDelete
        open={!!delId}
        title="Eliminar activo"
        body="Se borra el activo y sus ingresos recurrentes."
        pending={pending}
        onClose={() => setDelId(null)}
        onConfirm={async () => {
          if (!delId) return;
          setPending(true);
          try {
            await deleteAsset({ data: { id: delId } });
            toast.success("Eliminado");
            setDelId(null);
            await router.invalidate();
          } finally {
            setPending(false);
          }
        }}
      />
    </div>
  );
}

/**
 * A unit price, or an explanation of why there isn't one.
 *
 * The two reasons a price is missing are different and the tip says which:
 * no quantity on record (nothing to divide by) versus no quote (the value
 * column is showing cost). Printing a dash for both would hide a fixable
 * data gap behind a feed problem.
 */
function PriceCell({
  row,
  price,
  kind,
}: {
  row: PositionRow;
  price: number | null;
  kind: "buy" | "now";
}) {
  const currency = row.asset.currency;
  if (price == null) {
    const why =
      row.quantity == null
        ? "Falta la cantidad: sin unidades no hay precio unitario. Editá la posición y cargala."
        : "Sin cotización: el valor mostrado es el costo, así que no hay precio actual.";
    return (
      <Tip inline content={why}>
        <span className="text-subtle">—</span>
      </Tip>
    );
  }
  const tip = (
    <div className="space-y-0.5">
      <p className="mb-1 border-b border-line pb-1 text-accent">
        {kind === "buy" ? "PRECIO DE COMPRA" : "PRECIO ACTUAL"}
      </p>
      <TipRow
        label={row.perHundred ? "por 100 VN" : "por unidad"}
        value={formatUnitPrice(price, currency)}
      />
      <TipRow
        label={row.perHundred ? "nominal" : "cantidad"}
        value={row.quantity?.toLocaleString("es-AR") ?? "—"}
      />
      {row.pricePct != null ? (
        <TipRow
          label="var. precio"
          value={formatPct(row.pricePct)}
          tone={row.pricePct >= 0 ? "gain" : "loss"}
        />
      ) : null}
      {row.perHundred ? (
        <p className="mt-1 border-t border-line pt-1 text-subtle">
          Los bonos cotizan cada 100 de valor nominal, igual que en el broker.
        </p>
      ) : null}
    </div>
  );
  return (
    <Tip inline content={tip}>
      <span className={kind === "now" ? "text-fg" : undefined}>
        {formatUnitPrice(price, currency)}
        {kind === "now" && row.pricePct != null ? (
          <span
            className={`ml-1 text-[10px] ${row.pricePct >= 0 ? "text-gain" : "text-loss"}`}
          >
            {formatPct(row.pricePct)}
          </span>
        ) : null}
      </span>
    </Tip>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="min-w-0 border border-border/60 px-2 py-1.5">
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted">
        {label}
      </p>
      <p
        className={`truncate font-mono text-[13px] tabular-nums ${
          tone === "gain"
            ? "text-gain"
            : tone === "loss"
              ? "text-loss"
              : "text-fg"
        }`}
      >
        {value}
      </p>
      {sub ? (
        <p className="truncate font-mono text-[10px] text-subtle">{sub}</p>
      ) : null}
    </div>
  );
}

/**
 * A donut per asset class, each split into the positions inside it.
 *
 * This replaced a bar chart of value per position, which drew the same numbers
 * the table right above it already listed — a picture of a column is not a
 * breakdown. The question a holder actually has is what each class is made of:
 * of my crypto, how much is BTC. So the slice percentages are shares of their
 * own category, and the category's share of the book is stated once, on the
 * header, where it cannot be confused with them.
 */
function Breakdown({
  filter,
  pies,
  stats,
}: {
  filter: string;
  pies: CategoryPie[];
  stats: ReturnType<typeof positionStats>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`grid items-start gap-2 ${
          pies.length === 1 ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"
        }`}
      >
        {pies.map((pie) => (
          <CategoryDonut key={pie.type} pie={pie} solo={pies.length === 1} />
        ))}
      </div>

      <Monitor title="STATS" bodyClassName="p-2">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          <Stat
            label="VALOR"
            value={formatUsd(stats.valueUsd)}
            sub={`${stats.count} ${stats.count === 1 ? "posición" : "posiciones"}`}
          />
          <Stat label="COSTO" value={formatUsd(stats.costUsd)} />
          <Stat
            label="P&L PRECIO"
            value={formatUsd(stats.pnlUsd)}
            sub={
              stats.costUsd > 0 ? formatPct(stats.pnlPct) : "sin costo cargado"
            }
            tone={stats.pnlUsd >= 0 ? "gain" : "loss"}
          />
          <Stat
            label="RENTA COBRADA"
            value={formatUsd(stats.incomeUsd)}
            sub={
              stats.projectedIncomeUsd > 0
                ? `${formatUsd(stats.projectedIncomeUsd)} agendado 12M`
                : "sin cobros registrados"
            }
            tone={stats.incomeUsd > 0 ? "gain" : undefined}
          />
          <Stat
            label="RETORNO TOTAL"
            value={formatUsd(stats.totalUsd)}
            sub={
              stats.totalPct == null
                ? "precio + renta"
                : `${formatPct(stats.totalPct)} · precio + renta`
            }
            tone={stats.totalUsd >= 0 ? "gain" : "loss"}
          />
          <Stat
            label="MEJOR"
            value={
              stats.best
                ? `${stats.best.asset.ticker || stats.best.asset.name}`
                : "—"
            }
            sub={stats.best ? formatPct(stats.best.pnlPct) : "sin cost basis"}
            tone={stats.best && stats.best.pnlPct >= 0 ? "gain" : undefined}
          />
          <Stat
            label="PEOR"
            value={
              stats.worst
                ? `${stats.worst.asset.ticker || stats.worst.asset.name}`
                : "—"
            }
            sub={
              stats.worst ? formatPct(stats.worst.pnlPct) : "una sola posición"
            }
            tone={stats.worst && stats.worst.pnlPct < 0 ? "loss" : undefined}
          />
          <Stat
            label="CONCENTRACIÓN"
            value={`${stats.topWeightPct.toFixed(0)}%`}
            sub={stats.topName ? `top: ${stats.topName}` : undefined}
          />
        </div>
        {stats.unpricedCount > 0 || stats.noQuantityCount > 0 ? (
          <p className="mt-1.5 border-t border-line pt-1.5 font-mono text-[11px] text-loss">
            {stats.unpricedCount > 0
              ? `${stats.unpricedCount} sin cotización (se muestra el costo)`
              : null}
            {stats.unpricedCount > 0 && stats.noQuantityCount > 0
              ? " · "
              : null}
            {stats.noQuantityCount > 0
              ? `${stats.noQuantityCount} sin cantidad (no hay precio unitario)`
              : null}
          </p>
        ) : null}
        <p className="mt-1 font-mono text-[10px] text-subtle">
          {filter === "ALL"
            ? "Cada torta reparte una clase entre sus posiciones: los % son de esa clase, no del patrimonio."
            : "Los % son de esta clase. Todo en USD al FX promedio."}
        </p>
      </Monitor>
    </div>
  );
}

/** Slices past this become one "resto" wedge; the legend still lists them all. */
const MAX_SLICES = 9;

function CategoryDonut({ pie, solo }: { pie: CategoryPie; solo: boolean }) {
  const head = pie.items.slice(0, MAX_SLICES);
  const tail = pie.items.slice(MAX_SLICES);
  const slices =
    tail.length > 0
      ? [
          ...head,
          {
            id: "__rest",
            label: `+${tail.length} más`,
            valueUsd: tail.reduce((s, i) => s + i.valueUsd, 0),
            pnlUsd: tail.reduce((s, i) => s + i.pnlUsd, 0),
            pnlPct: 0,
            pct: tail.reduce((s, i) => s + i.pct, 0),
            unpriced: false,
          },
        ]
      : head;

  return (
    <Monitor
      title={pie.label.toUpperCase()}
      action={
        <span className="font-mono text-[10px] tracking-widest text-subtle">
          {pie.bookPct.toFixed(1)}% DEL LIBRO
        </span>
      }
    >
      <div
        className={`flex flex-col items-center gap-3 ${solo ? "sm:flex-row sm:items-start" : ""}`}
      >
        <div className="relative h-[150px] w-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="valueUsd"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={70}
                paddingAngle={slices.length > 1 ? 2 : 0}
                stroke="#0a0a0a"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {slices.map((s, i) => (
                  <Cell
                    key={s.id}
                    fill={SLICE_COLORS[i % SLICE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={CHART_TIP} content={<ItemTip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-[9px] tracking-[0.14em] text-muted">
              {pie.items.length} {pie.items.length === 1 ? "POS" : "POS"}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-fg">
              {formatUsd(pie.valueUsd)}
            </span>
            <span
              className={`font-mono text-[10px] tabular-nums ${pie.pnlUsd >= 0 ? "text-gain" : "text-loss"}`}
            >
              {pie.costUsd > 0
                ? formatPct(((pie.valueUsd - pie.costUsd) / pie.costUsd) * 100)
                : "—"}
            </span>
          </div>
        </div>

        {/* Every item, not just the ones that got their own wedge. On its own
            the panel has the width for two columns and no reason to clip; in
            the grid the list scrolls, capped a little above the donut so a cut
            row is visibly a cut row rather than a list that ends there. */}
        <ul
          className={
            solo
              ? "w-full min-w-0 flex-1 space-y-0.5 sm:columns-2 sm:gap-x-6 sm:space-y-0"
              : "max-h-[168px] w-full min-w-0 flex-1 space-y-0.5 overflow-y-auto"
          }
        >
          {pie.items.map((item, i) => (
            <li
              key={item.id}
              className={`flex items-center gap-1.5 font-mono text-[11px] ${
                solo ? "break-inside-avoid py-px" : ""
              }`}
            >
              <span
                className="size-2 shrink-0"
                style={{
                  background:
                    i < MAX_SLICES
                      ? SLICE_COLORS[i % SLICE_COLORS.length]
                      : SLICE_COLORS[MAX_SLICES % SLICE_COLORS.length],
                }}
              />
              <Link
                to="/assets/$id"
                params={{ id: item.id }}
                className="min-w-0 flex-1 truncate text-muted hover:text-accent"
              >
                {item.label}
                {item.unpriced ? (
                  <span className="ml-1 text-[9px] text-loss">S/P</span>
                ) : null}
              </Link>
              <span className="w-11 shrink-0 text-right tabular-nums text-fg">
                {item.pct.toFixed(1)}%
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums text-subtle">
                {formatUsd(item.valueUsd)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {!solo && pie.items.length > MAX_SLICES ? (
        // Without this the list just stops at whatever row the box cuts, which
        // reads as "that is all of them".
        <p className="mt-1 border-t border-line pt-1 font-mono text-[10px] text-subtle">
          {pie.items.length} posiciones · scrolleá la lista para verlas todas
        </p>
      ) : null}
    </Monitor>
  );
}

type PieItem = CategoryPie["items"][number];

function ItemTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: PieItem }[];
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return (
    <div className="z-[100] max-w-xs border border-accent bg-black px-2 py-1.5 font-mono text-[12px] leading-snug text-fg">
      <p className="mb-1 border-b border-line pb-1 text-accent">{item.label}</p>
      <TipRow label="valor" value={formatUsd(item.valueUsd)} />
      <TipRow
        label="de la clase"
        value={`${item.pct.toFixed(1)}%`}
        tone="muted"
      />
      {item.id !== "__rest" ? (
        <TipRow
          label="P&L"
          value={`${formatUsd(item.pnlUsd)} · ${formatPct(item.pnlPct)}`}
          tone={item.pnlUsd >= 0 ? "gain" : "loss"}
        />
      ) : (
        <TipRow
          label="P&L"
          value={formatUsd(item.pnlUsd)}
          tone={item.pnlUsd >= 0 ? "gain" : "loss"}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------- flujos proyectados */

/**
 * What the positions on screen are contracted to pay over the next year.
 *
 * The average is per paying month rather than per calendar month: a book of
 * semi-annual ONs pays in two months out of twelve, and "$X per month" would
 * describe an income that never actually arrives on ten of them.
 */
function FlowsPanel({
  flows,
  filter,
}: {
  flows: FlowProjection;
  filter: string;
}) {
  const what =
    filter === "BOND"
      ? "cupones y amortizaciones"
      : filter === "REAL_ESTATE"
        ? "alquileres"
        : "cobros";
  return (
    <Monitor
      title="FLUJOS PROYECTADOS 12M"
      action={
        <HelpTip
          content={`${what[0].toUpperCase()}${what.slice(1)} ya agendados para los próximos 12 meses, desde el calendario y los flujos recurrentes. Es un plan, no plata cobrada.`}
        />
      }
    >
      <div className="grid gap-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={flows.months}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{
                    fill: "#6b7280",
                    fontSize: 9,
                    fontFamily: "IBM Plex Mono",
                  }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={6}
                />
                <YAxis
                  width={48}
                  tick={{
                    fill: "#6b7280",
                    fontSize: 10,
                    fontFamily: "IBM Plex Mono",
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatUsd(v)}
                />
                <Tooltip
                  cursor={{ fill: "#ffffff0d" }}
                  contentStyle={CHART_TIP}
                  content={<FlowTip />}
                />
                <Bar
                  dataKey="totalUsd"
                  fill="#2dd4bf"
                  isAnimationActive={false}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <TableWrap className="mx-0 max-h-[320px] overflow-y-auto px-0">
          <table className="w-full font-mono text-[12px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-[11px] tracking-widest text-accent">
                <th className="px-2 py-1">MES</th>
                <th className="px-2 py-1">QUIÉN PAGA</th>
                <th className="px-2 py-1 text-right">USD</th>
              </tr>
            </thead>
            <tbody>
              {flows.months.map((m) => (
                <tr
                  key={m.key}
                  className="border-b border-border/50 hover:bg-raised/40"
                >
                  <td className="px-2 py-1 whitespace-nowrap text-subtle">
                    {m.label}
                  </td>
                  <td className="px-2 py-1 text-muted">
                    <span className="line-clamp-2">
                      {m.items.map((i) => i.name).join(", ")}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-gain">
                    {formatUsd(m.totalUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-x-4 border-t border-line pt-1 font-mono text-[11px] sm:grid-cols-4">
        <TipRow
          label="total 12M"
          value={formatUsd(flows.totalUsd)}
          tone="gain"
        />
        <TipRow
          label={`prom. de ${flows.payingMonths} ${flows.payingMonths === 1 ? "mes que paga" : "meses que pagan"}`}
          value={formatUsd(flows.avgPerPayingMonth)}
        />
        <TipRow
          label="pico"
          value={
            flows.peak
              ? `${flows.peak.label} · ${formatUsd(flows.peak.totalUsd)}`
              : "—"
          }
          tone="muted"
        />
        <TipRow
          label="yield sobre valor"
          value={flows.yieldPct == null ? "—" : `${flows.yieldPct.toFixed(1)}%`}
          tone="muted"
        />
      </div>
    </Monitor>
  );
}

function FlowTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: FlowProjection["months"][number] }[];
}) {
  const m = payload?.[0]?.payload;
  if (!active || !m) return null;
  return (
    <div className="z-[100] max-w-xs border border-accent bg-black px-2 py-1.5 font-mono text-[12px] leading-snug text-fg">
      <p className="mb-1 border-b border-line pb-1 text-accent">{m.label}</p>
      {m.items.map((i) => (
        <TipRow key={i.assetId} label={i.name} value={formatUsd(i.amountUsd)} />
      ))}
      <div className="mt-1 border-t border-line pt-1">
        <TipRow label="TOTAL" value={formatUsd(m.totalUsd)} tone="gain" />
      </div>
    </div>
  );
}
