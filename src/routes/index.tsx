import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
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
import { Monitor } from "@/components/monitor";
import { getPortfolio } from "@/lib/server/portfolio";
import {
  computeDashboard,
  INCOME_KIND_META,
  type IncomeKind,
} from "@/lib/portfolio-math";
import { formatUsd, formatPct } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: () => getPortfolio(),
  component: Dashboard,
});

const COLORS = ["#ff6d00", "#22c55e", "#3b82f6", "#a855f7", "#eab308", "#ef4444"];

function Dashboard() {
  const data = Route.useLoaderData();
  const s = computeDashboard(data);
  const today = new Date().toISOString().slice(0, 10);
  const snapPts = data.snapshots.map((x) => ({
    date: x.date,
    label: x.date.slice(5, 7) + "/" + x.date.slice(2, 4),
    value: x.totalUsd,
  }));
  if (!snapPts.some((x) => x.date === today)) {
    snapPts.push({
      date: today,
      label: today.slice(5, 7) + "/" + today.slice(2, 4),
      value: s.nw,
    });
  } else {
    const last = snapPts.find((x) => x.date === today);
    if (last) last.value = s.nw;
  }
  const chart = snapPts;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <Monitor title="NET WORTH USD" className="col-span-2 md:col-span-1 lg:col-span-2">
          <p
            className={`font-mono text-2xl font-medium tabular-nums md:text-3xl ${
              s.pnl >= 0 ? "text-gain" : "text-loss"
            }`}
          >
            {formatUsd(s.nw)}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted">
            {s.delta.prior != null
              ? `${formatPct(s.delta.pct)} vs prev · ${formatUsd(s.delta.delta)}`
              : "sin snapshot previo"}
          </p>
        </Monitor>
        <Monitor title="P&L">
          <p
            className={`font-mono text-xl tabular-nums ${
              s.pnl >= 0 ? "text-gain" : "text-loss"
            }`}
          >
            {formatUsd(s.pnl)}
          </p>
          <p className="font-mono text-[10px] text-subtle">
            assets {formatUsd(s.assetsUsd)} · cost {formatUsd(s.costUsd)}
          </p>
        </Monitor>
        <Monitor title="INCOME YIELD">
          <p className="font-mono text-xl tabular-nums text-accent">
            {s.yieldPct ? `${s.yieldPct.toFixed(1)}%` : "—"}
          </p>
          <p className="font-mono text-[10px] text-muted">
            {formatUsd(s.monthly)}/mo · {formatUsd(s.annualIncome)}/yr
          </p>
        </Monitor>
        <Monitor title="RE YIELD">
          <p className="font-mono text-xl tabular-nums text-accent">
            {s.reYield ? `${s.reYield.toFixed(1)}%` : "—"}
          </p>
          <p className="font-mono text-[10px] text-subtle">bruto anual</p>
        </Monitor>
        <Monitor title="CONCENTRATION">
          <p
            className={`font-mono text-xl tabular-nums ${
              s.topWeight >= 30 ? "text-loss" : "text-fg"
            }`}
          >
            {s.topWeight.toFixed(0)}%
          </p>
          <p className="truncate font-mono text-[10px] text-muted">
            top · {s.holdings[0]?.name ?? "—"}
          </p>
        </Monitor>
        <Monitor title="LIQUID / CASH">
          <p className="font-mono text-xl tabular-nums">{s.liq.liquidPct.toFixed(0)}%</p>
          <p className="font-mono text-[10px] text-muted">
            cash {formatUsd(s.cashUsd)} · {s.cashPct.toFixed(0)}% NW
          </p>
        </Monitor>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <Monitor title="ALLOCATION">
          <div className="flex h-40 items-center gap-3">
            <div className="h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={s.alloc}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={28}
                    outerRadius={55}
                    stroke="#000"
                    strokeWidth={1}
                  >
                    {s.alloc.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#000",
                      border: "1px solid #ff6d00",
                      borderRadius: 0,
                      fontSize: 11,
                      fontFamily: "IBM Plex Mono",
                    }}
                    formatter={(v: number) => formatUsd(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-hidden">
              {s.alloc.map((a, i) => (
                <div key={a.key} className="flex items-center gap-2 font-mono text-[10px]">
                  <span
                    className="h-2 w-2 shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="w-12 text-muted">{a.name}</span>
                  <span className="flex-1 truncate text-fg">{formatUsd(a.value)}</span>
                  <span className="text-subtle">
                    {((a.value / s.allocTotal) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Monitor>

        <Monitor title="INCOME WINDOW">
          <div className="flex h-40 flex-col justify-between">
            <div>
              <p className="font-mono text-[10px] text-muted">NEXT 30D</p>
              <p className="font-mono text-2xl tabular-nums text-gain">{formatUsd(s.next30)}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-muted">NEXT 90D</p>
              <p className="font-mono text-xl tabular-nums text-fg">{formatUsd(s.next90)}</p>
            </div>
            <div className="border-t border-line pt-2">
              <p className="font-mono text-[10px] text-muted">UPCOMING</p>
              {s.projected.slice(0, 4).map((e, i) => (
                <div key={i} className="flex justify-between font-mono text-[10px]">
                  <span className="truncate text-subtle">{e.date.slice(5)} · {e.name}</span>
                  <span className="text-gain">{formatUsd(e.amountUsd)}</span>
                </div>
              ))}
              {s.projected.length === 0 ? (
                <p className="font-mono text-[10px] text-muted">sin proyecciones</p>
              ) : null}
            </div>
          </div>
        </Monitor>

        <Monitor title="INSIGHTS">
          <ul className="flex h-40 flex-col gap-1.5 overflow-auto">
            {s.insights.map((line, i) => (
              <li key={i} className="font-mono text-[11px] leading-snug text-fg">
                <span className="text-accent">›</span> {line}
              </li>
            ))}
          </ul>
        </Monitor>
      </div>

      <Monitor title="HOLDINGS RANK">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-line text-left text-[10px] text-muted">
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
              {s.holdings.map((h, i) => (
                <tr key={h.id} className="border-b border-line/50">
                  <td className="py-1 pr-2 text-subtle">{i + 1}</td>
                  <td className="py-1 pr-2">
                    <span className="text-fg">{h.name}</span>
                    {h.ticker ? (
                      <span className="ml-1 text-subtle">{h.ticker}</span>
                    ) : null}
                  </td>
                  <td className="py-1 pr-2 text-muted">{h.type}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{formatUsd(h.valueUsd)}</td>
                  <td
                    className={`py-1 pr-2 text-right tabular-nums ${
                      h.pnlUsd >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {formatUsd(h.pnlUsd)}
                  </td>
                  <td
                    className={`py-1 pr-2 text-right tabular-nums ${
                      h.pnlPct >= 0 ? "text-gain" : "text-loss"
                    }`}
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
        </div>
      </Monitor>

      <div className="grid gap-2 lg:grid-cols-3">
        <Monitor title="NW SERIES">
          <div className="h-36">
            {chart.length >= 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide domain={["dataMin - 4000", "dataMax + 4000"]} />
                  <Tooltip
                    contentStyle={{
                      background: "#000",
                      border: "1px solid #ff6d00",
                      borderRadius: 0,
                      fontSize: 11,
                      fontFamily: "IBM Plex Mono",
                    }}
                    formatter={(v: number) => [formatUsd(v), "NW"]}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="value"
                    stroke="#ff6d00"
                    strokeWidth={1.25}
                    fill="#ff6d00"
                    fillOpacity={0.12}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-mono text-xs text-muted">NO SERIES</p>
            )}
          </div>
        </Monitor>
        <Monitor title="PROJ INCOME 12M">
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
                        contentStyle={{
                          background: "#000",
                          border: "1px solid #ff6d00",
                          borderRadius: 0,
                          fontSize: 11,
                          fontFamily: "IBM Plex Mono",
                        }}
                        formatter={(v: number, name: string) => [
                          formatUsd(v),
                          INCOME_KIND_META[name as IncomeKind]?.label ?? name,
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
                      className="flex items-center gap-1 font-mono text-[9px] text-muted"
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
        <Monitor title="P&L BY TYPE">
          <div className="flex h-36 flex-col justify-center gap-2">
            {s.byType.map((t) => (
              <div key={t.type} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="w-16 text-muted">{t.type.slice(0, 8)}</span>
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
      </div>
    </div>
  );
}
