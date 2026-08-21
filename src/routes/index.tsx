import { createFileRoute } from "@tanstack/react-router";
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardGrid } from "@/components/dashboard-grid";
import { Hint, Monitor, TableWrap } from "@/components/ui/monitor";
import { Tip } from "@/components/ui/tip";
import { Pager, usePager } from "@/components/ui/pager";
import { getPortfolio } from "@/lib/server/portfolio";
import { computeAnalytics } from "@/lib/analytics";
import { portfolioReturn } from "@/lib/returns";
import { bondMetrics } from "@/lib/bonds";
import {
  computeDashboard,
  INCOME_KIND_META,
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

function Dashboard() {
  const data = Route.useLoaderData();
  // Both passes walk every asset/tx several times — compute once per payload.
  const s = useMemo(() => computeDashboard(data), [data]);
  const a = useMemo(() => computeAnalytics(data), [data]);
  const ret = useMemo(() => portfolioReturn(data), [data]);
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

  const holdingsPager = usePager(s.holdings, 10);
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
      {/* KPIs fijos — no se reordenan */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <Monitor
          title="NET WORTH USD"
          emphasis="primary"
          className="col-span-2"
          action={
            <Tip
              inline
              content="Activos + cash − liabilities, valuado al FX promedio (oficial+blue+MEP)/3."
            >
              <Hint />
            </Tip>
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
            <Tip
              inline
              content="Ganancia/pérdida no realizada = valor de mercado − cost basis de todos los activos."
            >
              <Hint />
            </Tip>
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
            <Tip
              inline
              content="Ingreso recurrente anualizado ÷ net worth. Incluye cupones, alquileres y dividendos mapeados."
            >
              <Hint />
            </Tip>
          }
        >
          <Tip
            content={`Mensual estimado ${formatUsd(s.monthly)} · anual ${formatUsd(s.annualIncome)}`}
          >
            <p className="font-mono text-xl tabular-nums text-accent">
              {s.yieldPct ? `${s.yieldPct.toFixed(1)}%` : "—"}
            </p>
          </Tip>
          <p className="font-mono text-[11px] text-muted">
            {formatUsd(s.monthly)}/mo · {formatUsd(s.annualIncome)}/yr
          </p>
        </Monitor>

        <Monitor
          title="RE YIELD"
          action={
            <Tip
              inline
              content="Yield bruto de real estate: alquileres anuales ÷ valor de propiedades."
            >
              <Hint />
            </Tip>
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
            <Tip
              inline
              content="Peso del holding más grande sobre el net worth. >30% se marca en rojo."
            >
              <Hint />
            </Tip>
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
            top · {s.holdings[0]?.name ?? "—"}
          </p>
        </Monitor>

        <Monitor
          title="LIQUID / CASH"
          action={
            <Tip
              inline
              content="% líquido ≈ cash + crypto + stocks. Excluye real estate e ilíquidos."
            >
              <Hint />
            </Tip>
          }
        >
          <Tip
            content={`Cash puro ${formatUsd(s.cashUsd)} (${s.cashPct.toFixed(1)}% del NW)`}
          >
            <p className="font-mono text-xl tabular-nums">
              {s.liq.liquidPct.toFixed(0)}%
            </p>
          </Tip>
          <p className="font-mono text-[11px] text-muted">
            cash {formatUsd(s.cashUsd)} · {s.cashPct.toFixed(0)}% NW
          </p>
        </Monitor>

        <Monitor
          title="DEBT"
          action={
            <Tip
              inline
              content="Deudas / liabilities cargadas en Settings. Ya están restadas del net worth."
            >
              <Hint />
            </Tip>
          }
        >
          <p
            className={`font-mono text-xl tabular-nums ${debtUsd > 0 ? "text-loss" : "text-fg"}`}
          >
            {debtUsd > 0 ? formatUsd(debtUsd) : "—"}
          </p>
          <p className="font-mono text-[11px] text-muted">
            {data.liabilities.length}{" "}
            {data.liabilities.length === 1 ? "pasivo" : "pasivos"}
            {s.nw > 0 && debtUsd > 0
              ? ` · ${((debtUsd / (s.nw + debtUsd)) * 100).toFixed(0)}% LTV`
              : ""}
          </p>
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
                <Tip
                  inline
                  content="Distribución del patrimonio por asset class. Hover una fila o el donut para detalle."
                >
                  <Hint />
                </Tip>
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
                <Tip
                  inline
                  content="Ingresos proyectados desde flujos recurrentes y cupones en los próximos 30/90 días."
                >
                  <Hint />
                </Tip>
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
                      <span className="truncate text-subtle">
                        {e.date.slice(5)} · {e.name}
                      </span>
                      <span className="text-gain">
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
                <Tip
                  inline
                  content="Alertas automáticas: concentración, yield, gaps de allocation y eventos próximos."
                >
                  <Hint />
                </Tip>
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
                <Tip
                  inline
                  content="Activos ordenados por valor. P&L vs cost basis. WGT = peso sobre el net worth."
                >
                  <Hint />
                </Tip>
              }
            >
              <TableWrap>
                <table className="w-full min-w-[640px] border-collapse font-mono text-[12px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] text-muted">
                      <th className="py-1 pr-2">#</th>
                      <th className="py-1 pr-2">NAME</th>
                      <th className="py-1 pr-2">TYPE</th>
                      <th className="py-1 pr-2 text-right">VALUE</th>
                      <th className="py-1 pr-2 text-right">P&L</th>
                      <th className="py-1 pr-2 text-right">%</th>
                      <th className="py-1 text-right">WGT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdingsPager.slice.map((h, i) => (
                      <tr
                        key={h.id}
                        className="border-b border-line/50 hover:bg-raised/40"
                        title={`${h.name}${h.ticker ? ` (${h.ticker})` : ""} · ${h.type} | ${formatUsd(h.valueUsd)} | P&L ${formatUsd(h.pnlUsd)} | ${h.weight.toFixed(2)}%`}
                      >
                        <td className="py-1 pr-2 text-subtle">
                          {holdingsPager.from + i}
                        </td>
                        <td className="py-1 pr-2">
                          <span className="text-fg">{h.name}</span>
                          {h.ticker ? (
                            <span className="ml-1 text-subtle">{h.ticker}</span>
                          ) : null}
                        </td>
                        <td className="py-1 pr-2 text-muted">{h.type}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {formatUsd(h.valueUsd)}
                        </td>
                        <td
                          className={`py-1 pr-2 text-right tabular-nums ${h.pnlUsd >= 0 ? "text-gain" : "text-loss"}`}
                        >
                          {formatUsd(h.pnlUsd)}
                        </td>
                        <td
                          className={`py-1 pr-2 text-right tabular-nums ${h.pnlPct >= 0 ? "text-gain" : "text-loss"}`}
                        >
                          {formatPct(h.pnlPct)}
                        </td>
                        <td className="py-1 text-right tabular-nums text-subtle">
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
                <Tip
                  inline
                  content="Histórico de net worth desde snapshots diarios. El punto de hoy es el NW live."
                >
                  <Hint />
                </Tip>
              }
            >
              <div className="h-36">
                {chart.length >= 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chart}
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
                <Tip
                  inline
                  content="Barras apiladas por tipo de ingreso (cupón, alquiler, dividendo, amortización)."
                >
                  <Hint />
                </Tip>
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
                <Tip
                  inline
                  content="P&L no realizado agrupado por asset class vs su cost basis."
                >
                  <Hint />
                </Tip>
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
                <Tip
                  inline
                  content="Cupones proyectados próximos 12 meses, agrupados por bono/ticker. TOTAL = suma USD; NEXT = próxima fecha."
                >
                  <Hint />
                </Tip>
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
                <Tip
                  inline
                  content="Calendario de pagos proyectados (cupones + alquileres + amort) mes a mes a 24 meses."
                >
                  <Hint />
                </Tip>
              }
            >
              <div className="h-40">
                {a.calendar.some((c) => c.total > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={a.calendar}
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
                        interval={2}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={CHART_TIP}
                        formatter={(
                          v: number,
                          _n: string,
                          p: { payload?: { count?: number } },
                        ) => [
                          `${formatUsd(v)} · ${p?.payload?.count ?? 0} pagos`,
                          "Total",
                        ]}
                      />
                      <Bar dataKey="total" fill="#4aa3ff" fillOpacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="font-mono text-xs text-muted">sin calendario</p>
                )}
              </div>
            </Monitor>
          ),

          bondYields: (
            <Monitor
              title="BOND YIELDS"
              action={
                <Tip
                  inline
                  content="CUR = cupones de los próximos 12m sobre el valor actual. YTM = TIR de pagar hoy el precio y cobrar todo el schedule (actual/365, sin intereses corridos). DUR = duración modificada: variación aproximada de precio por cada punto de yield."
                >
                  <Hint />
                </Tip>
              }
            >
              <TableWrap>
                <table className="w-full min-w-[520px] border-collapse font-mono text-[12px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] text-muted">
                      <th className="py-1 pr-2">BOND</th>
                      <th className="py-1 pr-2 text-right">VALUE</th>
                      <th className="py-1 pr-2 text-right">CUR</th>
                      <th className="py-1 pr-2 text-right">YTM</th>
                      <th className="py-1 pr-2 text-right">DUR</th>
                      <th className="py-1 text-right">VTO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bondYieldsPager.slice.map((b) => (
                      <tr
                        key={b.id}
                        className="border-b border-line/50 hover:bg-raised/40"
                      >
                        <td className="py-1 pr-2 truncate text-fg">{b.name}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {formatUsd(b.priceUsd)}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums text-muted">
                          {b.currentYield === null
                            ? "—"
                            : `${(b.currentYield * 100).toFixed(1)}%`}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums text-accent">
                          {b.ytm === null
                            ? "—"
                            : `${(b.ytm * 100).toFixed(1)}%`}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums text-muted">
                          {b.modified === null
                            ? "—"
                            : `${b.modified.toFixed(1)}a`}
                        </td>
                        <td className="py-1 text-right tabular-nums text-subtle">
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
                <Tip
                  inline
                  content="Amortizaciones de capital proyectadas (tipo AMORT / principal) desde el schedule."
                >
                  <Hint />
                </Tip>
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
                <Tip
                  inline
                  content="Flujos reales del ledger (transactions) últimos 12 meses: income vs expense vs net."
                >
                  <Hint />
                </Tip>
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
                <Tip
                  inline
                  content="Comparación allocation real vs targets configurados. GAP positivo = overweight."
                >
                  <Hint />
                </Tip>
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
                <Tip
                  inline
                  content="Contribución individual al P&L no realizado. Ordenado de mayor ganancia a mayor pérdida."
                >
                  <Hint />
                </Tip>
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
                        <td className="py-1 pr-2 truncate text-fg">{r.name}</td>
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
                <Tip
                  inline
                  content="Exposición por moneda (assets + cash) convertida al FX promedio."
                >
                  <Hint />
                </Tip>
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
                <Tip
                  content={`Peak ${formatUsd(a.drawdown.peak)} · trough ${formatUsd(a.drawdown.trough)} · max DD ${a.drawdown.drawdownPct.toFixed(1)}%`}
                >
                  <Hint />
                </Tip>
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
                <Tip
                  inline
                  content="HHI = suma de pesos² (0–10000). >2500 = concentrado. Top3/Top5 = peso acumulado."
                >
                  <Hint />
                </Tip>
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
                      <span className="truncate text-subtle">{h.name}</span>
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
                <Tip
                  inline
                  content="Conteo de posiciones por asset class (proxy de diversificación, no correlación real)."
                >
                  <Hint />
                </Tip>
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
                <Tip
                  content={`NW base ${formatUsd(a.fxScenario.base)}. Escenarios revalúan solo balances ARS ±% sobre el FX promedio.`}
                >
                  <Hint />
                </Tip>
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
                <Tip
                  inline
                  content="Sugerencias cuando el gap vs target es ≥2 puntos porcentuales."
                >
                  <Hint />
                </Tip>
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
                <Tip
                  inline
                  content="Ratio valor/cost ordenado ascendente. <1.0 = underwater. Útil para tax-lot / harvest."
                >
                  <Hint />
                </Tip>
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
                        <td className="py-1 pr-2 truncate text-fg">{r.name}</td>
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
                <Tip
                  inline
                  content="Retorno money-weighted (XIRR, actual/365). Cada posición aporta su costo como egreso en la fecha de compra, los ingresos ya cobrados como entradas, y el valor actual como saldo final."
                >
                  <Hint />
                </Tip>
              }
            >
              {ret.annualised === null ? (
                <p className="font-mono text-xs text-muted">
                  sin fecha de compra en ninguna posición — cargá purchaseDate
                  para calcular retorno
                </p>
              ) : (
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
                  <div className="shrink-0">
                    <p
                      className={`font-mono text-2xl font-medium tabular-nums md:text-3xl ${
                        ret.annualised >= 0 ? "text-gain" : "text-loss"
                      }`}
                    >
                      {formatPct(ret.annualised * 100)}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-subtle">
                      anualizado · {ret.covered}/{ret.total} posiciones
                    </p>
                    {ret.simple !== null ? (
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
                    <table className="w-full min-w-[420px] border-collapse font-mono text-[12px]">
                      <thead>
                        <tr className="border-b border-line text-left text-[11px] text-muted">
                          <th className="py-1 pr-2">NAME</th>
                          <th className="py-1 pr-2 text-right">AÑOS</th>
                          <th className="py-1 pr-2 text-right">INGRESOS</th>
                          <th className="py-1 text-right">ANUAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnsPager.slice.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-line/50 hover:bg-raised/40"
                          >
                            <td className="py-1 pr-2 text-fg">
                              <span className="truncate">{r.name}</span>
                            </td>
                            <td className="py-1 pr-2 text-right tabular-nums text-muted">
                              {r.holdingYears === null
                                ? "—"
                                : r.holdingYears.toFixed(1)}
                            </td>
                            <td className="py-1 pr-2 text-right tabular-nums text-muted">
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

          goals: (
            <Monitor
              title="GOALS"
              action={
                <Tip
                  inline
                  content="Progreso hacia goals medido contra el net worth actual."
                >
                  <Hint />
                </Tip>
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
