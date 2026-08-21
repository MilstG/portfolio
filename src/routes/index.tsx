import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardGrid } from "@/components/dashboard-grid";
import { HelpTip, Monitor, TableWrap } from "@/components/ui/monitor";
import { Tip } from "@/components/ui/tip";
import { Pager, usePager } from "@/components/ui/pager";
import { RangeSelect, useRange } from "@/components/ui/range";
import { AssetLink, TipRow } from "@/components/ui/asset-link";
import { SortHeader, useSort } from "@/components/ui/sort";
import { getPortfolio } from "@/lib/server/portfolio";
import { computeAnalytics } from "@/lib/analytics";
import { portfolioReturn } from "@/lib/returns";
import { bondMetrics } from "@/lib/bonds";
import { computeBenchmark } from "@/lib/benchmark";
import {
  computeDashboard,
  INCOME_KIND_META,
  INCOME_KINDS,
  type IncomeKind,
} from "@/lib/portfolio-math";
import { formatUsd, formatPct, toUsd } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: () => getPortfolio(),
  component: Dashboard,
});

/** Mirrors --color-cat-* in styles.css: deliberately excludes the accent
 *  orange (interactive) and the P&L green/red (gain/loss) so that a colour in
 *  a chart never carries a second meaning. */
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

/**
 * Axis ticks: $1.4k / $18k / $1.4M, so a y-axis fits in 44px.
 *
 * Keeps a decimal below $10k — recharts picks ticks like 1400/2100/2800, and
 * rounding those to $1k/$2k/$3k drew a scale that did not match the data.
 */
function compactUsd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `$${Math.round(v / 1_000)}k`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}

type CalendarRow = {
  label: string;
  total: number;
} & Partial<Record<IncomeKind, number>>;

/** Month breakdown by income kind — a merged total hid what the money was. */
function CalendarTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload?: CalendarRow }[];
  label?: string | number;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const parts = INCOME_KINDS.filter((k) => (row[k] ?? 0) > 0);
  return (
    <div className="z-[100] max-w-xs border border-accent bg-black px-2 py-1.5 font-mono text-[12px] leading-snug text-fg">
      <p className="mb-1 border-b border-line pb-1 text-accent">{label}</p>
      {parts.map((k) => (
        <div key={k} className="flex justify-between gap-4">
          <span className="inline-flex items-center gap-1 text-subtle">
            <span
              className="inline-block size-2"
              style={{ background: INCOME_KIND_META[k].color }}
            />
            {INCOME_KIND_META[k].label}
          </span>
          <span className="tabular-nums">{formatUsd(row[k] ?? 0)}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-4 border-t border-line pt-1">
        <span className="text-subtle">TOTAL</span>
        <span className="tabular-nums text-gain">{formatUsd(row.total)}</span>
      </div>
      {parts.length === 0 ? (
        <p className="text-subtle">sin pagos este mes</p>
      ) : null}
    </div>
  );
}

function Dashboard() {
  const data = Route.useLoaderData();
  // Both passes walk every asset/tx several times — compute once per payload.
  const s = useMemo(() => computeDashboard(data), [data]);
  const a = useMemo(() => computeAnalytics(data), [data]);
  const ret = useMemo(() => portfolioReturn(data), [data]);
  const bench = useMemo(
    () => computeBenchmark(data.snapshots, data.fxHistory),
    [data.snapshots, data.fxHistory],
  );
  const bonds = useMemo(
    () => bondMetrics(data.assets, data.transactions, data.fx.average),
    [data.assets, data.transactions, data.fx.average],
  );
  const debtUsd = useMemo(
    () =>
      data.liabilities.reduce(
        (sum, l) => sum + toUsd(l.balance, l.currency, data.fx.average),
        0,
      ),
    [data],
  );
  const chart = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const pts = data.snapshots.map((x) => ({
      date: x.date,
      label: x.date.slice(5, 7) + "/" + x.date.slice(2, 4),
      value: x.totalUsd,
    }));
    const last = pts.find((x) => x.date === today);
    if (last) last.value = s.nw;
    else
      pts.push({
        date: today,
        label: today.slice(5, 7) + "/" + today.slice(2, 4),
        value: s.nw,
      });
    return pts;
  }, [data.snapshots, s.nw]);

  const nwRange = useRange(chart, "ALL");
  const unpricedAssets = useMemo(
    () => data.assets.filter((a) => a.unpriced),
    [data.assets],
  );
  /**
   * Everything known about one position, for the hover tip on any row that
   * names it. Each table shows three or four columns; this fills in the rest
   * rather than making the user open the detail page to see a cost basis.
   */
  const describeAsset = useMemo(() => {
    const byId = new Map(data.assets.map((x) => [x.id, x]));
    const holdingById = new Map(s.holdings.map((h) => [h.id, h]));
    const returnById = new Map(ret.perAsset.map((r) => [r.id, r]));
    const bondById = new Map(bonds.map((b) => [b.id, b]));
    const today = new Date().toISOString().slice(0, 10);
    const nextByAsset = new Map<string, { date: string; amount: number }>();
    for (const t of data.transactions) {
      if (!t.assetId || t.date < today) continue;
      const cur = nextByAsset.get(t.assetId);
      if (!cur || t.date < cur.date) {
        nextByAsset.set(t.assetId, {
          date: t.date,
          amount: toUsd(t.amount, t.currency, data.fx.average),
        });
      }
    }

    return (id: string) => {
      const asset = byId.get(id);
      if (!asset) return null;
      const h = holdingById.get(id);
      const r = returnById.get(id);
      const bond = bondById.get(id);
      const next = nextByAsset.get(id);
      const valueUsd = toUsd(asset.currentValue, asset.currency, data.fx.average);
      const costUsd = toUsd(asset.costBasis, asset.currency, data.fx.average);
      const pnl = valueUsd - costUsd;

      return (
        <div className="min-w-52 space-y-0.5">
          <p className="mb-1 border-b border-line pb-1 text-accent">
            {asset.name}
            {asset.ticker ? (
              <span className="ml-1 text-subtle">{asset.ticker}</span>
            ) : null}
          </p>
          <TipRow label="TIPO" value={asset.type} tone="muted" />
          {asset.quantity != null && asset.quantity !== 1 ? (
            <TipRow
              label="CANTIDAD"
              value={asset.quantity.toLocaleString("es-AR")}
              tone="muted"
            />
          ) : null}
          <TipRow label="COSTO" value={formatUsd(costUsd)} tone="muted" />
          <TipRow label="VALOR" value={formatUsd(valueUsd)} />
          <TipRow
            label="P&L"
            value={`${formatUsd(pnl)} · ${formatPct(costUsd > 0 ? (pnl / costUsd) * 100 : 0)}`}
            tone={pnl >= 0 ? "gain" : "loss"}
          />
          {h ? (
            <TipRow
              label="PESO"
              value={`${h.weight.toFixed(1)}%`}
              tone="muted"
            />
          ) : null}
          {asset.currency !== "USD" ? (
            <TipRow label="MONEDA" value={asset.currency} tone="muted" />
          ) : null}
          {asset.purchaseDate ? (
            <TipRow
              label="COMPRA"
              value={
                asset.purchaseDate +
                (r?.holdingYears != null
                  ? ` · ${r.holdingYears.toFixed(1)}a`
                  : "")
              }
              tone="muted"
            />
          ) : null}
          {r?.annualised != null ? (
            <TipRow
              label="ANUALIZADO"
              value={formatPct(r.annualised * 100)}
              tone={r.annualised >= 0 ? "gain" : "loss"}
            />
          ) : null}
          {r && r.incomeUsd > 0 ? (
            <TipRow
              label="COBRADO"
              value={formatUsd(r.incomeUsd)}
              tone="gain"
            />
          ) : null}
          {bond?.ytm != null ? (
            <TipRow label="YTM" value={formatPct(bond.ytm * 100)} />
          ) : null}
          {bond?.modified != null ? (
            <TipRow
              label="DURATION"
              value={`${bond.modified.toFixed(1)}a`}
              tone="muted"
            />
          ) : null}
          {next ? (
            <TipRow
              label="PRÓX. PAGO"
              value={`${next.date} · ${formatUsd(next.amount)}`}
              tone="gain"
            />
          ) : null}
          {asset.notes ? (
            <p className="mt-1 border-t border-line pt-1 text-subtle">
              {asset.notes}
            </p>
          ) : null}
        </div>
      );
    };
  }, [data.assets, data.transactions, data.fx.average, s.holdings, ret.perAsset, bonds]);

  const calendarKinds = useMemo(
    () => INCOME_KINDS.filter((k) => a.calendarStacked.some((r) => r[k] > 0)),
    [a.calendarStacked],
  );
  const calendarStats = useMemo(() => {
    const rows = a.calendarStacked;
    const total = rows.reduce((sum, r) => sum + r.total, 0);
    if (total <= 0) return null;
    const peak = rows.reduce((best, r) => (r.total > best.total ? r : best));
    const payments = a.calendar.reduce((sum, c) => sum + c.count, 0);
    return { total, avg: total / rows.length, peak, payments };
  }, [a.calendarStacked, a.calendar]);

  const holdingsSort = useSort(
    s.holdings,
    useMemo(
      () => ({
        name: (h: (typeof s.holdings)[number]) => h.name.toLowerCase(),
        type: (h: (typeof s.holdings)[number]) => h.type,
        cost: (h: (typeof s.holdings)[number]) => h.costUsd,
        value: (h: (typeof s.holdings)[number]) => h.valueUsd,
        pnl: (h: (typeof s.holdings)[number]) => h.pnlUsd,
        pnlPct: (h: (typeof s.holdings)[number]) => h.pnlPct,
        weight: (h: (typeof s.holdings)[number]) => h.weight,
      }),
      [],
    ),
    "value",
  );
  const holdingsPager = usePager(holdingsSort.sorted, 10);
  const couponsPager = usePager(a.coupons, 10);
  const amortsPager = usePager(a.amorts, 10);
  const bondYieldsPager = usePager(bonds, 10);
  const pnlContribPager = usePager(a.pnlContrib, 10);
  const costLadderPager = usePager(a.costLadder, 10);
  const returnsRanked = useMemo(
    () =>
      [...ret.perAsset].sort(
        (x, y) => (y.annualised ?? -Infinity) - (x.annualised ?? -Infinity),
      ),
    [ret.perAsset],
  );
  const returnsPager = usePager(returnsRanked, 6);

  return (
    <div className="flex flex-col gap-2">
      {unpricedAssets.length > 0 ? (
        <div className="border border-loss bg-loss/10 px-3 py-2 font-mono text-[12px]">
          <span className="text-loss">SIN PRECIO</span>{" "}
          <span className="text-fg">
            {unpricedAssets.length} activo
            {unpricedAssets.length === 1 ? "" : "s"} sin cotización:{" "}
            {unpricedAssets.map((a) => a.ticker || a.name).join(", ")}
          </span>
          <span className="text-muted">
            {" "}
            — se está usando el costo como valor. Revisá el ticker o cargá el
            valor a mano en{" "}
          </span>
          <Link to="/assets" className="text-accent underline">
            POS
          </Link>
          <span className="text-muted">.</span>
        </div>
      ) : null}

      {/* KPIs fijos — no se reordenan */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <Monitor
          title="NET WORTH USD"
          emphasis="primary"
          className="col-span-2"
          action={
            <HelpTip content="Activos + cash − liabilities, valuado al FX promedio (oficial+blue+MEP)/3." />
          }
        >
          <Tip
            content={
              <div className="space-y-0.5">
                <p>Assets {formatUsd(s.assetsUsd)}</p>
                <p>Cash {formatUsd(s.cashUsd)}</p>
                <p className="text-subtle">
                  P&L no realizado {formatUsd(s.pnl)}
                </p>
              </div>
            }
          >
            <p
              className={`font-mono text-2xl font-medium tabular-nums md:text-3xl ${
                s.pnl >= 0 ? "text-gain" : "text-loss"
              }`}
            >
              {formatUsd(s.nw)}
            </p>
          </Tip>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {s.delta.prior != null
              ? `${formatPct(s.delta.pct)} vs prev · ${formatUsd(s.delta.delta)}`
              : "sin snapshot previo"}
          </p>
        </Monitor>

        <Monitor
          title="P&L"
          action={
            <HelpTip content="Ganancia/pérdida no realizada = valor de mercado − cost basis de todos los activos." />
          }
        >
          <Tip
            content={`ROI ${s.costUsd ? ((s.pnl / s.costUsd) * 100).toFixed(1) : "0"}% sobre cost basis total.`}
          >
            <p
              className={`font-mono text-xl tabular-nums ${s.pnl >= 0 ? "text-gain" : "text-loss"}`}
            >
              {formatUsd(s.pnl)}
            </p>
          </Tip>
          <p className="font-mono text-[11px] text-subtle">
            assets {formatUsd(s.assetsUsd)} · cost {formatUsd(s.costUsd)}
          </p>
        </Monitor>

        <Monitor
          title="INCOME YIELD"
          action={
            <HelpTip content="Ingreso recurrente anualizado ÷ net worth. Incluye cupones, alquileres y dividendos mapeados." />
          }
        >
          <Tip
            content={`Mensual estimado ${formatUsd(s.monthly)} · anual ${formatUsd(s.annualIncome)}`}
          >
            <p className="font-mono text-xl tabular-nums text-accent">
              {s.yieldPct ? `${s.yieldPct.toFixed(1)}%` : "—"}
            </p>
          </Tip>
          <Link
            to="/cashflow"
            className="block font-mono text-[11px] text-muted underline decoration-line decoration-dotted underline-offset-[3px] hover:text-accent hover:decoration-accent hover:decoration-solid"
          >
            {formatUsd(s.monthly)}/mo · {formatUsd(s.annualIncome)}/yr
          </Link>
        </Monitor>

        <Monitor
          title="RE YIELD"
          action={
            <HelpTip content="Yield bruto de real estate: alquileres anuales ÷ valor de propiedades." />
          }
        >
          <p className="font-mono text-xl tabular-nums text-accent">
            {s.reYield ? `${s.reYield.toFixed(1)}%` : "—"}
          </p>
          <p className="font-mono text-[11px] text-subtle">bruto anual</p>
        </Monitor>

        <Monitor
          title="CONCENTRATION"
          action={
            <HelpTip content="Peso del holding más grande sobre el net worth. >30% se marca en rojo." />
          }
        >
          <Tip
            content={
              s.holdings[0]
                ? `${s.holdings[0].name}: ${formatUsd(s.holdings[0].valueUsd)}`
                : "Sin holdings"
            }
          >
            <p
              className={`font-mono text-xl tabular-nums ${s.topWeight >= 30 ? "text-loss" : "text-fg"}`}
            >
              {s.topWeight.toFixed(0)}%
            </p>
          </Tip>
          <p className="truncate font-mono text-[11px] text-muted">
            top ·{" "}
            {s.holdings[0] ? (
              <AssetLink
                id={s.holdings[0].id}
                name={s.holdings[0].name}
                tip={describeAsset(s.holdings[0].id)}
                className="text-muted"
              />
            ) : (
              "—"
            )}
          </p>
        </Monitor>

        <Monitor
          title="LIQUID / CASH"
          action={
            <HelpTip content="% líquido ≈ cash + crypto + stocks. Excluye real estate e ilíquidos." />
          }
        >
          <Tip
            content={`Cash puro ${formatUsd(s.cashUsd)} (${s.cashPct.toFixed(1)}% del NW)`}
          >
            <p className="font-mono text-xl tabular-nums">
              {s.liq.liquidPct.toFixed(0)}%
            </p>
          </Tip>
          <Link
            to="/cash"
            className="block font-mono text-[11px] text-muted underline decoration-line decoration-dotted underline-offset-[3px] hover:text-accent hover:decoration-accent hover:decoration-solid"
          >
            cash {formatUsd(s.cashUsd)} · {s.cashPct.toFixed(0)}% NW
          </Link>
        </Monitor>

        <Monitor
          title="DEBT"
          action={
            <HelpTip content="Deudas / liabilities cargadas en Settings. Ya están restadas del net worth." />
          }
        >
          <p
            className={`font-mono text-xl tabular-nums ${debtUsd > 0 ? "text-loss" : "text-fg"}`}
          >
            {debtUsd > 0 ? formatUsd(debtUsd) : "—"}
          </p>
          <Link
            to="/settings"
            className="block font-mono text-[11px] text-muted underline decoration-line decoration-dotted underline-offset-[3px] hover:text-accent hover:decoration-accent hover:decoration-solid"
          >
            {data.liabilities.length}{" "}
            {data.liabilities.length === 1 ? "pasivo" : "pasivos"}
            {s.nw > 0 && debtUsd > 0
              ? ` · ${((debtUsd / (s.nw + debtUsd)) * 100).toFixed(0)}% LTV`
              : ""}
          </Link>
        </Monitor>
      </div>

      {/* Paneles reordenables — 22 total */}
      <DashboardGrid
        panels={{
          allocation: (
            <Monitor
              title="ALLOCATION"
              emphasis="primary"
              action={
                <HelpTip content="Distribución del patrimonio por asset class. Hover una fila o el donut para detalle." />
              }
            >
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                {/* Donut fijo — sin overlays absolutos problemáticos */}
                <div className="relative mx-auto h-[140px] w-[140px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={s.alloc}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={62}
                        paddingAngle={2}
                        stroke="#0a0a0a"
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        {s.alloc.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={CHART_TIP}
                        formatter={(v: number, name: string) => [
                          `${formatUsd(Number(v))} · ${((Number(v) / (s.allocTotal || 1)) * 100).toFixed(1)}%`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-[9px] tracking-[0.14em] text-muted">
                      TOTAL
                    </span>
                    <span className="font-mono text-[12px] tabular-nums text-fg">
                      {formatUsd(s.allocTotal)}
                    </span>
                  </div>
                </div>

                {/* Legend vertical limpia */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  {s.alloc.map((row, i) => {
                    const pct =
                      s.allocTotal > 0 ? (row.value / s.allocTotal) * 100 : 0;
                    return (
                      <div
                        key={row.key}
                        className="flex items-center gap-2 font-mono text-[12px]"
                        title={`${row.name}: ${formatUsd(row.value)} · ${pct.toFixed(2)}% del patrimonio`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        <span className="w-12 shrink-0 text-muted">
                          {row.name}
                        </span>
                        <div className="h-1.5 min-w-0 flex-1 bg-line">
                          <div
                            className="h-1.5"
                            style={{
                              width: `${Math.min(100, pct)}%`,
                              background: COLORS[i % COLORS.length],
                            }}
                          />
                        </div>
                        <span className="w-[4.75rem] shrink-0 text-right tabular-nums text-fg">
                          {formatUsd(row.value)}
                        </span>
                        <span className="w-9 shrink-0 text-right tabular-nums text-subtle">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                  {s.alloc.length === 0 ? (
                    <p className="font-mono text-xs text-muted">
                      sin allocation
                    </p>
                  ) : null}
                </div>
              </div>
            </Monitor>
          ),

          incomeWindow: (
            <Monitor
              title="INCOME WINDOW"
              emphasis="primary"
              action={
                <HelpTip content="Ingresos proyectados desde flujos recurrentes y cupones en los próximos 30/90 días." />
              }
            >
              <div className="flex min-h-40 flex-col gap-2">
                <div>
                  <p className="font-mono text-[11px] text-muted">NEXT 30D</p>
                  <p className="font-mono text-2xl tabular-nums text-gain">
                    {formatUsd(s.next30)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[11px] text-muted">NEXT 90D</p>
                  <p className="font-mono text-xl tabular-nums text-fg">
                    {formatUsd(s.next90)}
                  </p>
                </div>
                <div className="border-t border-line pt-2">
                  <p className="font-mono text-[11px] text-muted">UPCOMING</p>
                  {s.projected.slice(0, 4).map((e, i) => (
                    <div
                      key={i}
                      className="flex justify-between font-mono text-[11px]"
                    >
                      {e.assetId && describeAsset(e.assetId) ? (
                        <AssetLink
                          id={e.assetId}
                          name={`${e.date.slice(5)} · ${e.name}`}
                          tip={describeAsset(e.assetId)}
                          className="text-subtle"
                        />
                      ) : (
                        <span className="truncate text-subtle">
                          {e.date.slice(5)} · {e.name}
                        </span>
                      )}
                      <span className="shrink-0 text-gain">
                        {formatUsd(e.amountUsd)}
                      </span>
                    </div>
                  ))}
                  {s.projected.length === 0 ? (
                    <p className="font-mono text-[11px] text-muted">
                      sin proyecciones
                    </p>
                  ) : null}
                </div>
              </div>
            </Monitor>
          ),

          insights: (
            <Monitor
              title="INSIGHTS"
              action={
                <HelpTip content="Alertas automáticas: concentración, yield, gaps de allocation y eventos próximos." />
              }
            >
              <ul className="flex h-40 flex-col gap-1.5 overflow-auto">
                {s.insights.map((line, i) => (
                  <li
                    key={i}
                    className="font-mono text-[12px] leading-snug text-fg"
                  >
                    <span className="text-accent">›</span> {line}
                  </li>
                ))}
              </ul>
            </Monitor>
          ),

          holdings: (
            <Monitor
              title="HOLDINGS RANK"
              emphasis="primary"
              action={
                <HelpTip content="Clic en cualquier columna para reordenar. P&L vs cost basis, WGT = peso sobre el net worth. Ordenando por P&L o por % cubre lo mismo que los paneles P&L CONTRIBUTION y COST LADDER." />
              }
            >
              <TableWrap>
                <table className="w-full border-collapse font-mono text-[12px] md:min-w-[640px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] text-muted">
                      <th className="hidden py-1 pr-2 sm:table-cell">#</th>
                      <SortHeader
                        label="NAME"
                        sortKey="name"
                        active={holdingsSort.key}
                        dir={holdingsSort.dir}
                        onSort={holdingsSort.toggle}
                        naturalDir="asc"
                      />
                      <SortHeader
                        label="TYPE"
                        sortKey="type"
                        active={holdingsSort.key}
                        dir={holdingsSort.dir}
                        onSort={holdingsSort.toggle}
                        naturalDir="asc"
                        className="hidden md:table-cell"
                      />
                      <SortHeader
                        label="COST"
                        sortKey="cost"
                        active={holdingsSort.key}
                        dir={holdingsSort.dir}
                        onSort={holdingsSort.toggle}
                        align="right"
                        className="hidden md:table-cell"
                      />
                      <SortHeader
                        label="VALUE"
                        sortKey="value"
                        active={holdingsSort.key}
                        dir={holdingsSort.dir}
                        onSort={holdingsSort.toggle}
                        align="right"
                      />
                      <SortHeader
                        label="P&L"
                        sortKey="pnl"
                        active={holdingsSort.key}
                        dir={holdingsSort.dir}
                        onSort={holdingsSort.toggle}
                        align="right"
                        className="hidden sm:table-cell"
                      />
                      <SortHeader
                        label="%"
                        sortKey="pnlPct"
                        active={holdingsSort.key}
                        dir={holdingsSort.dir}
                        onSort={holdingsSort.toggle}
                        align="right"
                      />
                      <SortHeader
                        label="WGT"
                        sortKey="weight"
                        active={holdingsSort.key}
                        dir={holdingsSort.dir}
                        onSort={holdingsSort.toggle}
                        align="right"
                        className="hidden sm:table-cell pr-0"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {holdingsPager.slice.map((h, i) => (
                      <tr
                        key={h.id}
                        className="border-b border-line/50 hover:bg-raised/40"
                      >
                        <td className="hidden py-1 pr-2 text-subtle sm:table-cell">
                          {holdingsPager.from + i}
                        </td>
                        <td className="py-1 pr-2">
                          <AssetLink
                            id={h.id}
                            name={h.name}
                            ticker={h.ticker}
                            tip={describeAsset(h.id)}
                          />
                        </td>
                        <td className="hidden py-1 pr-2 text-muted md:table-cell">
                          {h.type}
                        </td>
                        <td className="hidden py-1 pr-2 text-right tabular-nums text-muted md:table-cell">
                          {formatUsd(h.costUsd)}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {formatUsd(h.valueUsd)}
                        </td>
                        <td
                          className={`hidden py-1 pr-2 text-right tabular-nums sm:table-cell ${h.pnlUsd >= 0 ? "text-gain" : "text-loss"}`}
                        >
                          {formatUsd(h.pnlUsd)}
                        </td>
                        <td
                          className={`py-1 pr-2 text-right tabular-nums ${h.pnlPct >= 0 ? "text-gain" : "text-loss"}`}
                        >
                          {formatPct(h.pnlPct)}
                        </td>
                        <td className="hidden py-1 text-right tabular-nums text-subtle sm:table-cell">
                          {h.weight.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pager
                  page={holdingsPager.page}
                  totalPages={holdingsPager.totalPages}
                  total={holdingsPager.total}
                  from={holdingsPager.from}
                  to={holdingsPager.to}
                  onChange={holdingsPager.setPage}
                  className="mt-1"
                />
              </TableWrap>
            </Monitor>
          ),

          nwSeries: (
            <Monitor
              title="NW SERIES"
              action={
                <div className="flex items-center gap-1.5">
                  <RangeSelect
                    value={nwRange.range}
                    onChange={nwRange.setRange}
                  />
                  <HelpTip content="Histórico de net worth desde snapshots diarios. El punto de hoy es el NW live. Cargá historial viejo en CFG → HISTORIAL DE NET WORTH." />
                </div>
              }
            >
              <div className="h-36">
                {nwRange.slice.length >= 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={nwRange.slice}
                      margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="label"
                        tick={{
                          fill: "#6b7280",
                          fontSize: 10,
                          fontFamily: "IBM Plex Mono",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        hide
                        domain={["dataMin - 4000", "dataMax + 4000"]}
                      />
                      <Tooltip
                        contentStyle={CHART_TIP}
                        formatter={(v: number) => [formatUsd(v), "NW"]}
                      />
                      <Area
                        type="stepAfter"
                        dataKey="value"
                        stroke="#4aa3ff"
                        strokeWidth={1.25}
                        fill="#4aa3ff"
                        fillOpacity={0.12}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="font-mono text-xs text-muted">NO SERIES</p>
                )}
              </div>
            </Monitor>
          ),

          projIncome: (
            <Monitor
              title="PROJ INCOME 12M"
              action={
                <HelpTip content="Barras apiladas por tipo de ingreso (cupón, alquiler, dividendo, amortización)." />
              }
            >
              <div className="flex h-40 flex-col">
                {s.projStacked.some((m) => m.total > 0) ? (
                  <>
                    <div className="min-h-0 flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={s.projStacked}
                          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                        >
                          <XAxis
                            dataKey="label"
                            tick={{
                              fill: "#6b7280",
                              fontSize: 10,
                              fontFamily: "IBM Plex Mono",
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={CHART_TIP}
                            formatter={(v: number, name: string) => [
                              formatUsd(v),
                              INCOME_KIND_META[name as IncomeKind]?.label ??
                                name,
                            ]}
                          />
                          {s.projKinds.map((k) => (
                            <Bar
                              key={k}
                              dataKey={k}
                              stackId="inc"
                              fill={INCOME_KIND_META[k].color}
                              fillOpacity={0.9}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-line pt-1">
                      {s.projKinds.map((k) => (
                        <span
                          key={k}
                          className="flex items-center gap-1 font-mono text-[10px] text-muted"
                        >
                          <span
                            className="inline-block h-1.5 w-1.5"
                            style={{ background: INCOME_KIND_META[k].color }}
                          />
                          {INCOME_KIND_META[k].label}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="font-mono text-xs text-muted">NO PROJECTION</p>
                )}
              </div>
            </Monitor>
          ),

          pnlByType: (
            <Monitor
              title="P&L BY TYPE"
              action={
                <HelpTip content="P&L no realizado agrupado por asset class vs su cost basis." />
              }
            >
              <div className="flex h-36 flex-col justify-center gap-2">
                {s.byType.map((t) => (
                  <div
                    key={t.type}
                    className="flex items-center gap-2 font-mono text-[12px]"
                  >
                    <span className="w-16 text-muted">
                      {t.type.slice(0, 8)}
                    </span>
                    <div className="h-2 flex-1 bg-line">
                      <div
                        className="h-2"
                        style={{
                          width: `${Math.min(100, Math.abs(t.pnlPct))}%`,
                          background: t.pnl >= 0 ? "#22c55e" : "#ef4444",
                        }}
                      />
                    </div>
                    <span className={t.pnl >= 0 ? "text-gain" : "text-loss"}>
                      {formatPct(t.pnlPct)}
                    </span>
                  </div>
                ))}
                {s.byType.length === 0 ? (
                  <p className="font-mono text-xs text-muted">sin assets</p>
                ) : null}
              </div>
            </Monitor>
          ),

          coupons24: (
            <Monitor
              title="COUPONS 12M"
              action={
                <HelpTip content="Cupones proyectados próximos 12 meses, agrupados por bono/ticker. TOTAL = suma USD; NEXT = próxima fecha." />
              }
            >
              <TableWrap>
                <table className="w-full min-w-[480px] border-collapse font-mono text-[12px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] text-muted">
                      <th className="py-1 pr-2">#</th>
                      <th className="py-1 pr-2">NAME</th>
                      <th className="py-1 pr-2 text-right">TOTAL</th>
                      <th className="py-1 pr-2 text-right">N</th>
                      <th className="py-1 text-right">NEXT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {couponsPager.slice.map((c, i) => (
                      <tr
                        key={c.name + i}
                        className="border-b border-line/50 hover:bg-raised/40"
                      >
                        <td className="py-1 pr-2 text-subtle">
                          {couponsPager.from + i}
                        </td>
                        <td className="py-1 pr-2 truncate text-fg">{c.name}</td>
                        <td className="py-1 pr-2 text-right tabular-nums text-gain">
                          {formatUsd(c.total)}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums text-muted">
                          {c.count}
                        </td>
                        <td className="py-1 text-right tabular-nums text-subtle">
                          {c.next.slice(5)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {a.coupons.length === 0 ? (
                  <p className="font-mono text-xs text-muted">
                    sin cupones proyectados
                  </p>
                ) : (
                  <Pager
                    page={couponsPager.page}
                    totalPages={couponsPager.totalPages}
                    total={couponsPager.total}
                    from={couponsPager.from}
                    to={couponsPager.to}
                    onChange={couponsPager.setPage}
                    className="mt-1"
                  />
                )}
              </TableWrap>
            </Monitor>
          ),

          payCalendar: (
            <Monitor
              title="PAY CALENDAR 24M"
              action={
                <HelpTip content="Pagos proyectados mes a mes a 24 meses, apilados por tipo. Incluye recurrentes (alquileres) y el schedule fechado de los bonos." />
              }
            >
              {calendarStats === null ? (
                <p className="font-mono text-xs text-muted">sin calendario</p>
              ) : (
                <div className="flex h-56 flex-col">
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 font-mono text-[11px]">
                    <span className="text-muted">
                      total{" "}
                      <span className="tabular-nums text-gain">
                        {formatUsd(calendarStats.total)}
                      </span>
                    </span>
                    <span className="text-muted">
                      prom/mes{" "}
                      <span className="tabular-nums text-fg">
                        {formatUsd(calendarStats.avg)}
                      </span>
                    </span>
                    <span className="text-muted">
                      pico{" "}
                      <span className="tabular-nums text-fg">
                        {calendarStats.peak.label} ·{" "}
                        {formatUsd(calendarStats.peak.total)}
                      </span>
                    </span>
                    <span className="text-subtle">
                      {calendarStats.payments} pagos
                    </span>
                  </div>

                  <div className="min-h-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={a.calendarStacked}
                        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
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
                          interval={1}
                        />
                        {/* The bars were unreadable without a scale: a $200
                            month and a $2,000 month looked the same shape. */}
                        <YAxis
                          width={44}
                          tick={{
                            fill: "#6b7280",
                            fontSize: 9,
                            fontFamily: "IBM Plex Mono",
                          }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={compactUsd}
                        />
                        <ReferenceLine
                          y={calendarStats.avg}
                          stroke="#3a3a3a"
                          strokeDasharray="3 3"
                        />
                        <Tooltip
                          contentStyle={CHART_TIP}
                          cursor={{ fill: "#ffffff10" }}
                          content={<CalendarTip />}
                        />
                        {calendarKinds.map((k, i) => (
                          <Bar
                            key={k}
                            dataKey={k}
                            stackId="pay"
                            fill={INCOME_KIND_META[k].color}
                            fillOpacity={0.9}
                            radius={
                              i === calendarKinds.length - 1
                                ? [1, 1, 0, 0]
                                : undefined
                            }
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px]">
                    {calendarKinds.map((k) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 text-muted"
                      >
                        <span
                          className="inline-block size-2"
                          style={{ background: INCOME_KIND_META[k].color }}
                        />
                        {INCOME_KIND_META[k].label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Monitor>
          ),

          bondYields: (
            <Monitor
              title="BOND YIELDS"
              action={
                <HelpTip content="CUR = cupones de los próximos 12m sobre el valor actual. YTM = TIR de pagar hoy el precio y cobrar todo el schedule (actual/365, sin intereses corridos). DUR = duración modificada: variación aproximada de precio por cada punto de yield." />
              }
            >
              <TableWrap>
                <table className="w-full border-collapse font-mono text-[12px] md:min-w-[520px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] text-muted">
                      <th className="py-1 pr-2">BOND</th>
                      <th className="py-1 pr-2 text-right">VALUE</th>
                      <th className="hidden py-1 pr-2 text-right sm:table-cell">
                        CUR
                      </th>
                      <th className="py-1 pr-2 text-right">YTM</th>
                      <th className="hidden py-1 pr-2 text-right sm:table-cell">
                        DUR
                      </th>
                      <th className="hidden py-1 text-right md:table-cell">
                        VTO
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bondYieldsPager.slice.map((b) => (
                      <tr
                        key={b.id}
                        className="border-b border-line/50 hover:bg-raised/40"
                      >
                        <td className="py-1 pr-2">
                          <AssetLink
                            id={b.id}
                            name={b.name}
                            tip={describeAsset(b.id)}
                          />
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {formatUsd(b.priceUsd)}
                        </td>
                        <td className="hidden py-1 pr-2 text-right tabular-nums text-muted sm:table-cell">
                          {b.currentYield === null
                            ? "—"
                            : `${(b.currentYield * 100).toFixed(1)}%`}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums text-accent">
                          {b.ytm === null
                            ? "—"
                            : `${(b.ytm * 100).toFixed(1)}%`}
                        </td>
                        <td className="hidden py-1 pr-2 text-right tabular-nums text-muted sm:table-cell">
                          {b.modified === null
                            ? "—"
                            : `${b.modified.toFixed(1)}a`}
                        </td>
                        <td className="hidden py-1 text-right tabular-nums text-subtle md:table-cell">
                          {b.maturity ? b.maturity.slice(2, 7) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bonds.length === 0 ? (
                  <p className="font-mono text-xs text-muted">sin bonos</p>
                ) : (
                  <>
                    <Pager
                      page={bondYieldsPager.page}
                      totalPages={bondYieldsPager.totalPages}
                      total={bondYieldsPager.total}
                      from={bondYieldsPager.from}
                      to={bondYieldsPager.to}
                      onChange={bondYieldsPager.setPage}
                      className="mt-1"
                    />
                    {bonds.every((b) => b.ytm === null) ? (
                      <p className="mt-1 font-mono text-[11px] text-subtle">
                        YTM y DUR necesitan la devolución de capital en el
                        schedule. Hoy solo hay cupones cargados, así que los
                        flujos nunca recuperan el capital y no hay TIR que
                        calcular.
                      </p>
                    ) : null}
                  </>
                )}
              </TableWrap>
            </Monitor>
          ),

          amorts: (
            <Monitor
              title="AMORTIZATIONS"
              action={
                <HelpTip content="Amortizaciones de capital proyectadas (tipo AMORT / principal) desde el schedule." />
              }
            >
              <TableWrap>
                <table className="w-full min-w-[400px] border-collapse font-mono text-[12px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] text-muted">
                      <th className="py-1 pr-2">DATE</th>
                      <th className="py-1 pr-2">NAME</th>
                      <th className="py-1 text-right">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amortsPager.slice.map((e, i) => (
                      <tr
                        key={e.date + e.name + i}
                        className="border-b border-line/50 hover:bg-raised/40"
                      >
                        <td className="py-1 pr-2 tabular-nums text-subtle">
                          {e.date.slice(5)}
                        </td>
                        <td className="py-1 pr-2 truncate text-fg">{e.name}</td>
                        <td className="py-1 text-right tabular-nums text-gain">
                          {formatUsd(e.amountUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {a.amorts.length === 0 ? (
                  <p className="font-mono text-xs text-muted">
                    sin amortizaciones
                  </p>
                ) : (
                  <Pager
                    page={amortsPager.page}
                    totalPages={amortsPager.totalPages}
                    total={amortsPager.total}
                    from={amortsPager.from}
                    to={amortsPager.to}
                    onChange={amortsPager.setPage}
                    className="mt-1"
                  />
                )}
              </TableWrap>
            </Monitor>
          ),

          incomeExpense: (
            <Monitor
              title="INCOME / EXPENSE 12M"
              action={
                <HelpTip content="Flujos reales del ledger (transactions) últimos 12 meses: income vs expense vs net." />
              }
            >
              <div className="h-40">
                {a.incomeExpense.some((m) => m.income > 0 || m.expense > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={a.incomeExpense}
                      margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="label"
                        tick={{
                          fill: "#6b7280",
                          fontSize: 10,
                          fontFamily: "IBM Plex Mono",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={CHART_TIP}
                        formatter={(v: number, name: string) => [
                          formatUsd(v),
                          name,
                        ]}
                      />
                      <Bar
                        dataKey="income"
                        fill="#22c55e"
                        fillOpacity={0.9}
                        name="Income"
                      />
                      <Bar
                        dataKey="expense"
                        fill="#ef4444"
                        fillOpacity={0.9}
                        name="Expense"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="font-mono text-xs text-muted">
                    sin movimientos en ledger
                  </p>
                )}
              </div>
            </Monitor>
          ),

          allocTarget: (
            <Monitor
              title="ALLOC vs TARGET"
              action={
                <HelpTip content="Comparación allocation real vs targets configurados. GAP positivo = overweight." />
              }
            >
              <div className="flex h-40 flex-col gap-1.5 overflow-auto">
                {a.allocTarget.length === 0 ? (
                  <p className="font-mono text-xs text-muted">
                    sin targets — configurá en Settings
                  </p>
                ) : (
                  a.allocTarget.map((r) => (
                    <div
                      key={r.type}
                      className="flex items-center gap-2 font-mono text-[12px]"
                      title={`${r.type}: actual ${r.actualPct.toFixed(1)}% · target ${r.targetPct.toFixed(1)}% · ${formatUsd(r.actualUsd)}`}
                    >
                      <span className="w-16 shrink-0 truncate text-muted">
                        {r.type.slice(0, 8)}
                      </span>
                      <div className="relative h-2 flex-1 bg-line">
                        <div
                          className="absolute inset-y-0 left-0 bg-cat-1/50"
                          style={{ width: `${Math.min(100, r.actualPct)}%` }}
                        />
                        {r.targetPct > 0 ? (
                          <div
                            className="absolute inset-y-0 w-0.5 bg-fg"
                            style={{ left: `${Math.min(100, r.targetPct)}%` }}
                          />
                        ) : null}
                      </div>
                      <span
                        className={`w-12 shrink-0 text-right tabular-nums ${
                          Math.abs(r.gap) >= 5 ? "text-loss" : "text-subtle"
                        }`}
                      >
                        {r.gap >= 0 ? "+" : ""}
                        {r.gap.toFixed(0)}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Monitor>
          ),

          pnlContrib: (
            <Monitor
              title="P&L CONTRIBUTION"
              action={
                <HelpTip content="Contribución individual al P&L no realizado. Ordenado de mayor ganancia a mayor pérdida." />
              }
            >
              <TableWrap>
                <table className="w-full min-w-[480px] border-collapse font-mono text-[12px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] text-muted">
                      <th className="py-1 pr-2">#</th>
                      <th className="py-1 pr-2">NAME</th>
                      <th className="py-1 pr-2">TYPE</th>
                      <th className="py-1 pr-2 text-right">P&L</th>
                      <th className="py-1 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnlContribPager.slice.map((r, i) => (
                      <tr
                        key={r.id}
                        className="border-b border-line/50 hover:bg-raised/40"
                      >
                        <td className="py-1 pr-2 text-subtle">
                          {pnlContribPager.from + i}
                        </td>
                        <td className="py-1 pr-2">
                          <AssetLink
                            id={r.id}
                            name={r.name}
                            tip={describeAsset(r.id)}
                          />
                        </td>
                        <td className="py-1 pr-2 text-muted">{r.type}</td>
                        <td
                          className={`py-1 pr-2 text-right tabular-nums ${r.pnl >= 0 ? "text-gain" : "text-loss"}`}
                        >
                          {formatUsd(r.pnl)}
                        </td>
                        <td
                          className={`py-1 text-right tabular-nums ${r.pnlPct >= 0 ? "text-gain" : "text-loss"}`}
                        >
                          {formatPct(r.pnlPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pager
                  page={pnlContribPager.page}
                  totalPages={pnlContribPager.totalPages}
                  total={pnlContribPager.total}
                  from={pnlContribPager.from}
                  to={pnlContribPager.to}
                  onChange={pnlContribPager.setPage}
                  className="mt-1"
                />
              </TableWrap>
            </Monitor>
          ),

          fxExposure: (
            <Monitor
              title="FX EXPOSURE"
              action={
                <HelpTip content="Exposición por moneda (assets + cash) convertida al FX promedio." />
              }
            >
              <div className="flex h-36 flex-col justify-center gap-2">
                {a.fxExposure.map((c, i) => (
                  <div
                    key={c.code}
                    className="flex items-center gap-2 font-mono text-[12px]"
                    title={`${c.code}: ${formatUsd(c.valueUsd)} · ${c.weight.toFixed(1)}% del libro`}
                  >
                    <span className="w-10 text-muted">{c.code}</span>
                    <div className="h-2 flex-1 bg-line">
                      <div
                        className="h-2"
                        style={{
                          width: `${Math.min(100, c.weight)}%`,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                    <span className="w-14 text-right tabular-nums text-fg">
                      {c.weight.toFixed(0)}%
                    </span>
                    <span className="w-[4.5rem] text-right tabular-nums text-subtle">
                      {formatUsd(c.valueUsd)}
                    </span>
                  </div>
                ))}
                {a.fxExposure.length === 0 ? (
                  <p className="font-mono text-xs text-muted">sin data</p>
                ) : null}
              </div>
            </Monitor>
          ),

          drawdown: (
            <Monitor
              title="DRAWDOWN"
              action={
                <HelpTip content={`Peak ${formatUsd(a.drawdown.peak)} · trough ${formatUsd(a.drawdown.trough)} · max DD ${a.drawdown.drawdownPct.toFixed(1)}%`} />
              }
            >
              <div className="flex h-36 flex-col">
                <div className="mb-1 flex gap-3 font-mono text-[11px]">
                  <span className="text-muted">
                    MAX DD{" "}
                    <span className="text-loss">
                      {a.drawdown.drawdownPct.toFixed(1)}%
                    </span>
                  </span>
                  <span className="text-muted">
                    PEAK{" "}
                    <span className="text-fg">
                      {formatUsd(a.drawdown.peak)}
                    </span>
                  </span>
                </div>
                <div className="min-h-0 flex-1">
                  {a.drawdown.series.length >= 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={a.drawdown.series}
                        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                      >
                        <XAxis dataKey="date" hide />
                        <YAxis hide domain={["dataMin - 1", 0]} />
                        <Tooltip
                          contentStyle={CHART_TIP}
                          formatter={(v: number) => [`${v.toFixed(2)}%`, "DD"]}
                          labelFormatter={(l) => String(l)}
                        />
                        <Area
                          type="monotone"
                          dataKey="dd"
                          stroke="#ef4444"
                          strokeWidth={1.25}
                          fill="#ef4444"
                          fillOpacity={0.15}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="font-mono text-xs text-muted">
                      pocos snapshots
                    </p>
                  )}
                </div>
              </div>
            </Monitor>
          ),

          concentration: (
            <Monitor
              title="HHI / CONCENTRATION"
              action={
                <HelpTip content="HHI = suma de pesos² (0–10000). >2500 = concentrado. Top3/Top5 = peso acumulado." />
              }
            >
              <div className="flex h-36 flex-col justify-between">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="font-mono text-[11px] text-muted">HHI</p>
                    <p
                      className={`font-mono text-xl tabular-nums ${
                        a.concentration.hhi >= 2500 ? "text-loss" : "text-fg"
                      }`}
                    >
                      {a.concentration.hhi.toFixed(0)}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] text-muted">TOP 3</p>
                    <p className="font-mono text-xl tabular-nums text-accent">
                      {a.concentration.top3.toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] text-muted">TOP 5</p>
                    <p className="font-mono text-xl tabular-nums text-fg">
                      {a.concentration.top5.toFixed(0)}%
                    </p>
                  </div>
                </div>
                <div className="border-t border-line pt-2">
                  {a.concentration.holdings.slice(0, 4).map((h) => (
                    <div
                      key={h.id}
                      className="flex justify-between font-mono text-[11px]"
                    >
                      <AssetLink
                        id={h.id}
                        name={h.name}
                        tip={describeAsset(h.id)}
                        className="text-subtle"
                      />
                      <span className="tabular-nums text-fg">
                        {h.weight.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Monitor>
          ),

          correlation: (
            <Monitor
              title="CLASS MIX"
              action={
                <HelpTip content="Conteo de posiciones por asset class (proxy de diversificación, no correlación real)." />
              }
            >
              <div className="flex h-36 flex-col justify-center gap-2">
                {a.classes.map((c, i) => (
                  <div
                    key={c.type}
                    className="flex items-center gap-2 font-mono text-[12px]"
                  >
                    <span className="w-20 shrink-0 truncate text-muted">
                      {c.type}
                    </span>
                    <div className="h-2 flex-1 bg-line">
                      <div
                        className="h-2"
                        style={{
                          width: `${Math.min(100, c.count * 12)}%`,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums text-fg">
                      {c.count}
                    </span>
                  </div>
                ))}
                {a.classes.length === 0 ? (
                  <p className="font-mono text-xs text-muted">sin assets</p>
                ) : null}
              </div>
            </Monitor>
          ),

          fxScenario: (
            <Monitor
              title="FX STRESS"
              action={
                <HelpTip content={`NW base ${formatUsd(a.fxScenario.base)}. Escenarios revalúan solo balances ARS ±% sobre el FX promedio.`} />
              }
            >
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={a.fxScenario.scenarios}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="pct"
                      tick={{
                        fill: "#6b7280",
                        fontSize: 10,
                        fontFamily: "IBM Plex Mono",
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis hide domain={["dataMin - 2000", "dataMax + 2000"]} />
                    <Tooltip
                      contentStyle={CHART_TIP}
                      formatter={(v: number) => [formatUsd(v), "NW"]}
                      labelFormatter={(l) => `FX ${l}%`}
                    />
                    <Line
                      type="monotone"
                      dataKey="nw"
                      stroke="#4aa3ff"
                      strokeWidth={1.5}
                      dot={{ r: 2, fill: "#4aa3ff" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Monitor>
          ),

          rebalance: (
            <Monitor
              title="REBALANCE"
              action={
                <HelpTip content="Sugerencias cuando el gap vs target es ≥2 puntos porcentuales." />
              }
            >
              <div className="flex h-36 flex-col gap-1.5 overflow-auto">
                {a.rebalance.length === 0 ? (
                  <p className="font-mono text-xs text-muted">
                    {data.allocTargets.length === 0
                      ? "sin targets configurados"
                      : "dentro de banda (±2%)"}
                  </p>
                ) : (
                  a.rebalance.map((r) => (
                    <div
                      key={r.type}
                      className="flex items-center justify-between gap-2 border-b border-line/40 py-0.5 font-mono text-[12px]"
                    >
                      <span className="truncate text-fg">{r.type}</span>
                      <span
                        className={`shrink-0 ${r.action === "REDUCIR" ? "text-loss" : "text-gain"}`}
                      >
                        {r.action}
                      </span>
                      <span className="shrink-0 tabular-nums text-subtle">
                        {r.actualPct.toFixed(0)}% → {r.targetPct.toFixed(0)}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Monitor>
          ),

          costLadder: (
            <Monitor
              title="COST LADDER"
              action={
                <HelpTip content="Ratio valor/cost ordenado ascendente. <1.0 = underwater. Útil para tax-lot / harvest." />
              }
            >
              <TableWrap>
                <table className="w-full min-w-[480px] border-collapse font-mono text-[12px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] text-muted">
                      <th className="py-1 pr-2">#</th>
                      <th className="py-1 pr-2">NAME</th>
                      <th className="py-1 pr-2 text-right">COST</th>
                      <th className="py-1 pr-2 text-right">VALUE</th>
                      <th className="py-1 text-right">RATIO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costLadderPager.slice.map((r, i) => (
                      <tr
                        key={r.id}
                        className="border-b border-line/50 hover:bg-raised/40"
                      >
                        <td className="py-1 pr-2 text-subtle">
                          {costLadderPager.from + i}
                        </td>
                        <td className="py-1 pr-2">
                          <AssetLink
                            id={r.id}
                            name={r.name}
                            tip={describeAsset(r.id)}
                          />
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums text-muted">
                          {formatUsd(r.cost)}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {formatUsd(r.value)}
                        </td>
                        <td
                          className={`py-1 text-right tabular-nums ${r.ratio < 1 ? "text-loss" : "text-gain"}`}
                        >
                          {r.ratio.toFixed(2)}x
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pager
                  page={costLadderPager.page}
                  totalPages={costLadderPager.totalPages}
                  total={costLadderPager.total}
                  from={costLadderPager.from}
                  to={costLadderPager.to}
                  onChange={costLadderPager.setPage}
                  className="mt-1"
                />
              </TableWrap>
            </Monitor>
          ),

          returns: (
            <Monitor
              title="RETORNO ANUAL"
              emphasis="primary"
              action={
                <HelpTip content="Retorno money-weighted (XIRR, actual/365). Cada posición aporta su costo como egreso en la fecha de compra, los ingresos ya cobrados como entradas, y el valor actual como saldo final." />
              }
            >
              {ret.simple === null ? (
                <p className="font-mono text-xs text-muted">
                  sin fecha de compra en ninguna posición — cargá purchaseDate
                  para calcular retorno
                </p>
              ) : (
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
                  <div className="shrink-0">
                    {/* Under a year of history, the total return is the measured
                        number and the annualised one is an extrapolation, so the
                        total leads. */}
                    <p
                      className={`font-mono text-2xl font-medium tabular-nums md:text-3xl ${
                        (ret.annualisedLeads
                          ? (ret.annualised ?? 0)
                          : ret.simple) >= 0
                          ? "text-gain"
                          : "text-loss"
                      }`}
                    >
                      {ret.annualisedLeads && ret.annualised !== null
                        ? formatPct(ret.annualised * 100)
                        : formatPct(ret.simple * 100)}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-subtle">
                      {ret.annualisedLeads ? "anualizado" : "total"} ·{" "}
                      {ret.spanYears >= 1
                        ? `${ret.spanYears.toFixed(1)} años`
                        : `${Math.max(1, Math.round(ret.spanYears * 365))} días`}{" "}
                      · {ret.covered}/{ret.total} posiciones
                    </p>
                    {!ret.annualisedLeads ? (
                      <p className="font-mono text-[11px] text-muted">
                        {ret.annualised === null
                          ? "muy poca historia para anualizar"
                          : `${formatPct(ret.annualised * 100)} anualizado — extrapolado`}
                      </p>
                    ) : ret.simple !== null ? (
                      <p className="font-mono text-[11px] text-muted">
                        total {formatPct(ret.simple * 100)} sobre{" "}
                        {formatUsd(ret.costUsd)}
                      </p>
                    ) : null}
                    {ret.uncoveredValueUsd > 0 ? (
                      <p className="font-mono text-[11px] text-subtle">
                        sin fecha: {formatUsd(ret.uncoveredValueUsd)}
                      </p>
                    ) : null}
                  </div>

                  <TableWrap className="min-w-0 flex-1">
                    <table className="w-full border-collapse font-mono text-[12px] md:min-w-[420px]">
                      <thead>
                        <tr className="border-b border-line text-left text-[11px] text-muted">
                          <th className="py-1 pr-2">NAME</th>
                          <th className="hidden py-1 pr-2 text-right sm:table-cell">
                            AÑOS
                          </th>
                          <th className="hidden py-1 pr-2 text-right sm:table-cell">
                            INGRESOS
                          </th>
                          <th className="py-1 text-right">ANUAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnsPager.slice.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-line/50 hover:bg-raised/40"
                          >
                            <td className="py-1 pr-2">
                              <AssetLink
                                id={r.id}
                                name={r.name}
                                tip={describeAsset(r.id)}
                              />
                            </td>
                            <td className="hidden py-1 pr-2 text-right tabular-nums text-muted sm:table-cell">
                              {r.holdingYears === null
                                ? "—"
                                : r.holdingYears.toFixed(1)}
                            </td>
                            <td className="hidden py-1 pr-2 text-right tabular-nums text-muted sm:table-cell">
                              {r.incomeUsd > 0 ? formatUsd(r.incomeUsd) : "—"}
                            </td>
                            <td
                              className={`py-1 text-right tabular-nums ${
                                r.annualised === null
                                  ? "text-subtle"
                                  : r.annualised >= 0
                                    ? "text-gain"
                                    : "text-loss"
                              }`}
                            >
                              {r.annualised !== null
                                ? formatPct(r.annualised * 100)
                                : r.tooShort
                                  ? "< 1m"
                                  : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pager
                      page={returnsPager.page}
                      totalPages={returnsPager.totalPages}
                      total={returnsPager.total}
                      from={returnsPager.from}
                      to={returnsPager.to}
                      onChange={returnsPager.setPage}
                    />
                  </TableWrap>
                </div>
              )}
            </Monitor>
          ),

          benchmark: (
            <Monitor
              title="NW vs DÓLAR"
              action={
                <HelpTip content="Patrimonio y tipo de cambio rebasados a 100 al inicio de la ventana. El libro ya está valuado en USD, así que esto responde si creció más rápido de lo que se movió la moneda. fx_history suma una fila por cada día que actualizás el FX." />
              }
            >
              {bench === null ? (
                <p className="font-mono text-xs text-muted">
                  faltan datos para comparar: hacen falta al menos dos
                  snapshots posteriores al primer registro de FX. El historial
                  de FX suma una fila cada vez que actualizás el dólar en CFG.
                </p>
              ) : (
                <div className="flex h-40 flex-col">
                  <div className="mb-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px]">
                    <span className="text-fg">
                      NW{" "}
                      <span
                        className={
                          bench.nwChange >= 0 ? "text-gain" : "text-loss"
                        }
                      >
                        {formatPct(bench.nwChange * 100)}
                      </span>
                    </span>
                    <span className="text-cat-1">
                      BLUE {formatPct(bench.blueChange * 100)}
                    </span>
                    <span className="text-cat-2">
                      MEP {formatPct(bench.mepChange * 100)}
                    </span>
                    <span className="text-subtle">
                      {bench.from} → {bench.to}
                    </span>
                  </div>
                  <div className="min-h-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={bench.points}
                        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="label"
                          tick={{
                            fill: "#6b7280",
                            fontSize: 10,
                            fontFamily: "IBM Plex Mono",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                        <Tooltip
                          contentStyle={CHART_TIP}
                          formatter={(v: number, n: string) => [
                            v.toFixed(1),
                            n.toUpperCase(),
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="nw"
                          stroke="#f2f2f2"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="blue"
                          stroke="#4aa3ff"
                          strokeWidth={1.25}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="mep"
                          stroke="#a78bfa"
                          strokeWidth={1.25}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </Monitor>
          ),

          goals: (
            <Monitor
              title="GOALS"
              action={
                <HelpTip content="Progreso hacia goals medido contra el net worth actual." />
              }
            >
              <div className="flex h-36 flex-col gap-2 overflow-auto">
                {a.goals.length === 0 ? (
                  <p className="font-mono text-xs text-muted">
                    sin goals — agregá en Settings
                  </p>
                ) : (
                  a.goals.map((g) => (
                    <div
                      key={g.id}
                      className="space-y-1"
                      title={`${g.name}: ${formatUsd(s.nw)} / ${formatUsd(g.targetUsd)} · faltan ${formatUsd(g.remaining)}${g.targetDate ? ` · target ${g.targetDate}` : ""}`}
                    >
                      <div className="flex justify-between font-mono text-[12px]">
                        <span className="truncate text-fg">{g.name}</span>
                        <span className="tabular-nums text-accent">
                          {g.progressPct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-line">
                        <div
                          className="h-1.5 bg-accent"
                          style={{ width: `${Math.min(100, g.progressPct)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Monitor>
          ),
        }}
      />
    </div>
  );
}
