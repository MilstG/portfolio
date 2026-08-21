import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getPortfolio } from "@/lib/server/portfolio";
import { computeDashboard } from "@/lib/portfolio-math";
import { formatPct, formatUsd, toUsd } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: () => getPortfolio(),
  component: Dashboard,
});

const ALLOC_COLOR: Record<string, string> = {
  CRYPTO: "var(--color-crypto)",
  STOCK: "var(--color-stock)",
  BOND: "var(--color-bond)",
  REAL_ESTATE: "var(--color-real)",
  CASH: "var(--color-cash)",
  OTHER: "var(--color-muted)",
};

function Dashboard() {
  const data = Route.useLoaderData();
  const s = computeDashboard(data);
  const chart = data.snapshots.map((x) => ({
    label: x.date.slice(5, 7) + "/" + x.date.slice(2, 4),
    value: x.totalUsd,
  }));

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
            Δ {s.delta.delta >= 0 ? "+" : ""}
            {formatUsd(s.delta.delta)} ({formatPct(s.delta.pct)}) vs prior
          </p>
          <p className="font-mono text-[10px] text-subtle">
            FX AVG {data.fx.average.toFixed(0)} · OFC {data.fx.official.toFixed(0)} BLU{" "}
            {data.fx.blue.toFixed(0)} MEP {data.fx.mep.toFixed(0)}
          </p>
        </Monitor>
        <Monitor title="PNL VS COST">
          <p className={`font-mono text-xl tabular-nums ${s.pnl >= 0 ? "text-gain" : "text-loss"}`}>
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
        <Monitor title="INSIGHTS" className="lg:col-span-2">
          <ul className="space-y-1 font-mono text-[11px] text-fg">
            {s.insights.map((line, i) => (
              <li key={i} className="border-b border-border/40 py-1 text-muted">
                <span className="mr-2 text-accent">{String(i + 1).padStart(2, "0")}</span>
                {line}
              </li>
            ))}
            {s.insights.length === 0 ? (
              <li className="py-4 text-center text-subtle">Sin señales todavía.</li>
            ) : null}
          </ul>
        </Monitor>
        <Monitor title="INCOME WINDOW">
          <Row label="NEXT 30D" value={formatUsd(s.next30)} up={s.next30 >= 0} />
          <Row label="NEXT 90D" value={formatUsd(s.next90)} up={s.next90 >= 0} />
          <Row label="RECUR / MO" value={formatUsd(s.monthly)} up />
          <Row label="ANNUAL" value={formatUsd(s.annualIncome)} up />
          <div className="mt-2 border-t border-border/60 pt-2">
            <p className="mb-1 font-mono text-[10px] tracking-widest text-accent">UPCOMING</p>
            {s.projected.slice(0, 4).map((e, i) => (
              <div
                key={`${e.date}-${e.name}-${i}`}
                className="flex justify-between gap-2 border-b border-border/40 py-0.5 font-mono text-[10px]"
              >
                <span className="truncate text-muted">
                  {e.date.slice(5)} · {e.name}
                </span>
                <span className="tabular-nums text-gain">{formatUsd(e.amountUsd)}</span>
              </div>
            ))}
            {s.projected.length === 0 ? (
              <p className="font-mono text-[10px] text-subtle">Sin eventos recurrentes.</p>
            ) : null}
          </div>
        </Monitor>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <Monitor title="ALLOC">
          <div className="flex h-2 overflow-hidden bg-raised">
            {s.alloc.map((b) => (
              <div
                key={b.key}
                style={{
                  width: `${(b.value / s.allocTotal) * 100}%`,
                  background: ALLOC_COLOR[b.key] || "#666",
                }}
                title={b.name}
              />
            ))}
          </div>
          <table className="mt-2 w-full font-mono text-[11px]">
            <tbody>
              {s.alloc.map((b) => (
                <tr key={b.key} className="border-b border-border/60">
                  <td className="py-1">
                    <span
                      className="mr-2 inline-block size-1.5"
                      style={{ background: ALLOC_COLOR[b.key] || "#666" }}
                    />
                    {b.name}
                  </td>
                  <td className="py-1 text-right tabular-nums text-muted">
                    {((b.value / s.allocTotal) * 100).toFixed(1)}%
                  </td>
                  <td className="py-1 text-right tabular-nums">{formatUsd(b.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Monitor>
        <Monitor title="CURRENCY">
          <table className="w-full font-mono text-[11px]">
            <tbody>
              {s.currencies.map((c) => (
                <tr key={c.code} className="border-b border-border/60">
                  <td className="py-1 text-accent">{c.code}</td>
                  <td className="py-1 text-right tabular-nums text-muted">
                    {c.weight.toFixed(1)}%
                  </td>
                  <td className="py-1 text-right tabular-nums">{formatUsd(c.valueUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 border-t border-border/60 pt-2 font-mono text-[10px] text-muted">
            <div className="flex justify-between">
              <span>LIQUID</span>
              <span className="tabular-nums text-fg">
                {formatUsd(s.liq.liquid)} · {s.liq.liquidPct.toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>ILLIQUID</span>
              <span className="tabular-nums text-fg">
                {formatUsd(s.liq.illiquid)} · {s.liq.illiquidPct.toFixed(0)}%
              </span>
            </div>
          </div>
        </Monitor>
        <Monitor title="PNL BY CLASS">
          <table className="w-full font-mono text-[11px]">
            <tbody>
              {s.byType.map((r) => (
                <tr key={r.type} className="border-b border-border/60">
                  <td className="py-1">{r.type}</td>
                  <td
                    className={`py-1 text-right tabular-nums ${
                      r.pnl >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {formatUsd(r.pnl)}
                  </td>
                  <td
                    className={`py-1 text-right tabular-nums ${
                      r.pnlPct >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {formatPct(r.pnlPct)}
                  </td>
                </tr>
              ))}
              {s.byType.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-subtle" colSpan={3}>
                    Sin activos
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Monitor>
      </div>

      <Monitor title="BOOK · RANKED BY VALUE">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] font-mono text-[11px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] tracking-widest text-accent">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">NAME</th>
                <th className="py-1 pr-2">TYPE</th>
                <th className="py-1 pr-2 text-right">VALUE</th>
                <th className="py-1 pr-2 text-right">WGT</th>
                <th className="py-1 pr-2 text-right">PNL</th>
                <th className="py-1 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {s.holdings.slice(0, 12).map((h, i) => (
                <tr key={h.id} className="border-b border-border/50">
                  <td className="py-1 pr-2 text-subtle">{String(i + 1).padStart(2, "0")}</td>
                  <td className="max-w-[160px] truncate py-1 pr-2">
                    {h.type !== "CASH" ? (
                      <Link
                        to="/assets/$id"
                        params={{ id: h.id }}
                        className="text-fg hover:text-accent"
                      >
                        {h.ticker || h.name}
                      </Link>
                    ) : (
                      <span className="text-fg">{h.name}</span>
                    )}
                    {h.type !== "CASH" && h.ticker ? (
                      <span className="ml-1 text-[10px] text-subtle">{h.name}</span>
                    ) : null}
                  </td>
                  <td className="py-1 pr-2 text-muted">{h.type}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{formatUsd(h.valueUsd)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums text-muted">
                    {h.weight.toFixed(1)}%
                  </td>
                  <td
                    className={`py-1 pr-2 text-right tabular-nums ${
                      h.pnlUsd >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {formatUsd(h.pnlUsd)}
                  </td>
                  <td
                    className={`py-1 text-right tabular-nums ${
                      h.pnlPct >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {formatPct(h.pnlPct)}
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
            {chart.length > 1 ? (
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
          <div className="h-36">
            {s.projMonths.some((m) => m.total > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.projMonths} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#6b7280", fontSize: 9, fontFamily: "IBM Plex Mono" }}
                    axisLine={false}
                    tickLine={false}
                    interval={1}
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
                    formatter={(v: number) => [formatUsd(v), "IN"]}
                  />
                  <Bar dataKey="total" fill="#00e676" fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-mono text-xs text-muted">SIN PROYECCIÓN</p>
            )}
          </div>
        </Monitor>
        <Monitor
          title="TICKER"
          extra={
            <Link to="/cashflow" className="font-mono text-[10px] text-accent hover:underline">
              FLUJO {">"}
            </Link>
          }
        >
          <table className="w-full font-mono text-[11px]">
            <tbody>
              {data.transactions.slice(0, 8).map((t) => (
                <tr key={t.id} className="border-b border-border/60">
                  <td className="truncate py-1 pr-2 text-muted">{t.date.slice(5)}</td>
                  <td className="truncate py-1">{t.description}</td>
                  <td
                    className={`py-1 text-right tabular-nums ${
                      t.amount >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {t.amount >= 0 ? "+" : ""}
                    {formatUsd(Math.abs(toUsd(t.amount, t.currency, data.fx.average)))}
                  </td>
                </tr>
              ))}
              {data.transactions.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-subtle" colSpan={3}>
                    Sin movimientos
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Monitor>
      </div>
    </div>
  );
}

function Monitor({
  title,
  children,
  extra,
  className = "",
}: {
  title: string;
  children: ReactNode;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-border bg-surface ${className}`}>
      <header className="flex items-center justify-between border-b border-border bg-raised px-2 py-1">
        <h2 className="font-mono text-[10px] tracking-widest text-accent">{title}</h2>
        {extra}
      </header>
      <div className="p-2">{children}</div>
    </section>
  );
}

function Row({ label, value, up }: { label: string; value: string; up: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1 font-mono text-[11px]">
      <span className="truncate text-muted">{label}</span>
      <span className={`tabular-nums ${up ? "text-gain" : "text-loss"}`}>{value}</span>
    </div>
  );
}
