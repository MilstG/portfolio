import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
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
  formatUnitPrice,
  positionBreakdown,
  positionRows,
  positionStats,
  type PositionRow,
} from "@/lib/positions";
import type { Asset } from "@/lib/types";
import { ASSET_TYPES, formatPct, formatUsd } from "@/lib/utils";

const TYPE_VALUES = ASSET_TYPES.map((t) => t.value) as readonly string[];
const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ASSET_TYPES.map((t) => [t.value, t.label]),
);

/** Same categorical ramp as the dashboard; see COLORS in routes/index.tsx. */
const COLORS = [
  "#4aa3ff",
  "#a78bfa",
  "#f5d565",
  "#2dd4bf",
  "#f472b6",
  "#94a3b8",
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
  const rows = useMemo(() => {
    const all = positionRows(data.assets, fx, TYPE_LABELS);
    return filter === "ALL" ? all : all.filter((r) => r.asset.type === filter);
  }, [data.assets, fx, filter]);

  const stats = useMemo(() => positionStats(rows), [rows]);
  const slices = useMemo(
    () => positionBreakdown(rows, filter === "ALL" ? "type" : "position"),
    [rows, filter],
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
          <table className="w-full font-mono text-[12px] md:min-w-[820px]">
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
                <th className="px-2 py-1.5 text-right">P&L</th>
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
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums ${r.pnlUsd >= 0 ? "text-gain" : "text-loss"}`}
                    >
                      {formatUsd(r.pnlUsd)}
                      <span className="block text-[11px] opacity-80 sm:ml-1 sm:inline">
                        {formatPct(r.pnlPct)}
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
        <Breakdown filter={filter} slices={slices} stats={stats} />
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

type Slice = ReturnType<typeof positionBreakdown>[number];

/** Value and P&L side by side, plus the totals for the current filter. */
function Breakdown({
  filter,
  slices,
  stats,
}: {
  filter: string;
  slices: Slice[];
  stats: ReturnType<typeof positionStats>;
}) {
  // A long tail of tiny positions turns the chart into a row of hairlines; the
  // rest is folded into one bar so the total still adds up.
  const MAX_BARS = 8;
  const shown = slices.slice(0, MAX_BARS);
  const rest = slices.slice(MAX_BARS);
  const restValue = rest.reduce((s, r) => s + r.valueUsd, 0);
  const restCost = rest.reduce((s, r) => s + r.costUsd, 0);
  const chart =
    rest.length > 0
      ? [
          ...shown,
          {
            key: "__rest",
            label: `+${rest.length} más`,
            valueUsd: restValue,
            costUsd: restCost,
            pnlUsd: rest.reduce((s, r) => s + r.pnlUsd, 0),
            pnlPct:
              restCost > 0 ? ((restValue - restCost) / restCost) * 100 : 0,
            weightPct: rest.reduce((s, r) => s + r.weightPct, 0),
            count: rest.length,
          },
        ]
      : shown;

  const label = filter === "ALL" ? "clase" : "posición";
  const height = Math.max(120, chart.length * 22 + 24);

  return (
    <div className="grid gap-2 lg:grid-cols-3">
      <Monitor
        title={`VALOR POR ${filter === "ALL" ? "CLASE" : "POSICIÓN"}`}
        className="lg:col-span-2"
        action={
          <HelpTip
            content={`Valor en USD de cada ${label} dentro del filtro activo. Hover para costo, P&L y peso.`}
          />
        }
      >
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chart}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={82}
                tick={{
                  fill: "#9aa0a6",
                  fontSize: 10,
                  fontFamily: "IBM Plex Mono",
                }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "#ffffff0d" }}
                contentStyle={CHART_TIP}
                content={<SliceTip />}
              />
              <Bar dataKey="valueUsd" isAnimationActive={false} barSize={14}>
                {chart.map((s, i) => (
                  <Cell key={s.key} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Monitor>

      <Monitor
        title="P&L"
        action={
          <HelpTip content="P&L no realizado por cada barra del gráfico de al lado: valor actual menos costo. La línea es el cero." />
        }
      >
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chart}
              layout="vertical"
              margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" hide />
              <ReferenceLine x={0} stroke="#2a2a2a" />
              <Tooltip
                cursor={{ fill: "#ffffff0d" }}
                contentStyle={CHART_TIP}
                content={<SliceTip />}
              />
              <Bar dataKey="pnlUsd" isAnimationActive={false} barSize={14}>
                {chart.map((s) => (
                  <Cell
                    key={s.key}
                    fill={s.pnlUsd >= 0 ? "#22c55e" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Monitor>

      <Monitor title="STATS" className="lg:col-span-3" bodyClassName="p-2">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="VALOR"
            value={formatUsd(stats.valueUsd)}
            sub={`${stats.count} ${stats.count === 1 ? "posición" : "posiciones"}`}
          />
          <Stat label="COSTO" value={formatUsd(stats.costUsd)} />
          <Stat
            label="P&L"
            value={formatUsd(stats.pnlUsd)}
            sub={
              stats.costUsd > 0 ? formatPct(stats.pnlPct) : "sin costo cargado"
            }
            tone={stats.pnlUsd >= 0 ? "gain" : "loss"}
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
          Todo en USD al FX promedio; los precios unitarios quedan en la moneda
          de cada posición.
        </p>
      </Monitor>
    </div>
  );
}

/** Shared tooltip for both breakdown charts. */
function SliceTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: Slice }[];
}) {
  const s = payload?.[0]?.payload;
  if (!active || !s) return null;
  return (
    <div className="z-[100] max-w-xs border border-accent bg-black px-2 py-1.5 font-mono text-[12px] leading-snug text-fg">
      <p className="mb-1 border-b border-line pb-1 text-accent">{s.label}</p>
      <TipRow label="valor" value={formatUsd(s.valueUsd)} />
      <TipRow label="costo" value={formatUsd(s.costUsd)} tone="muted" />
      <TipRow
        label="P&L"
        value={`${formatUsd(s.pnlUsd)}${s.costUsd > 0 ? ` · ${formatPct(s.pnlPct)}` : ""}`}
        tone={s.pnlUsd >= 0 ? "gain" : "loss"}
      />
      <TipRow label="peso" value={`${s.weightPct.toFixed(1)}%`} tone="muted" />
      {s.count > 1 ? (
        <TipRow label="posiciones" value={String(s.count)} tone="muted" />
      ) : null}
    </div>
  );
}
