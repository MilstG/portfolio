import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getPortfolio } from "@/lib/server/portfolio";
import { monthlyRecurringUsd, netWorthUsd, realEstateYield } from "@/lib/portfolio-math";
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
};

function Dashboard() {
  const data = Route.useLoaderData();
  const { assets, accounts, recurring, transactions, snapshots, fx } = data;
  const nw = netWorthUsd(data);
  const cashUsd = accounts.reduce((s, a) => s + toUsd(a.balance, a.currency, fx.average), 0);
  const costUsd = assets.reduce((s, a) => s + toUsd(a.costBasis, a.currency, fx.average), 0);
  const assetsUsd = assets.reduce((s, a) => s + toUsd(a.currentValue, a.currency, fx.average), 0);
  const pnl = assetsUsd - costUsd;
  const monthly = monthlyRecurringUsd(recurring, fx.average);
  const yieldRe = realEstateYield(assets, recurring, fx.average);

  const buckets = [
    { key: "CRYPTO", name: "CRYPTO", value: 0 },
    { key: "STOCK", name: "EQTY", value: 0 },
    { key: "BOND", name: "FI", value: 0 },
    { key: "REAL_ESTATE", name: "RE", value: 0 },
    { key: "CASH", name: "CASH", value: cashUsd },
  ];
  for (const a of assets) {
    const b = buckets.find((x) => x.key === a.type);
    if (b) b.value += toUsd(a.currentValue, a.currency, fx.average);
  }
  const alloc = buckets.filter((b) => b.value > 0);
  const totalAlloc = alloc.reduce((s, b) => s + b.value, 0) || 1;

  const ranked = [...assets].sort((a, b) => {
    const pa = a.costBasis ? (a.currentValue - a.costBasis) / a.costBasis : 0;
    const pb = b.costBasis ? (b.currentValue - b.costBasis) / b.costBasis : 0;
    return pb - pa;
  });
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  const chart = snapshots.map((s) => ({
    label: s.date.slice(5, 7),
    value: s.totalUsd,
  }));

  const income = transactions
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + toUsd(t.amount, t.currency, fx.average), 0);
  const expense = transactions
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + toUsd(t.amount, t.currency, fx.average), 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Monitor title="NET WORTH USD" wide>
          <p className={`font-mono text-3xl font-medium tabular-nums ${pnl >= 0 ? "text-gain" : "text-loss"}`}>
            {formatUsd(nw)}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted">
            FX AVG {fx.average.toFixed(0)} · OFC {fx.official.toFixed(0)} BLU {fx.blue.toFixed(0)} MEP {fx.mep.toFixed(0)}
          </p>
        </Monitor>
        <Monitor title="PNL">
          <p className={`font-mono text-xl tabular-nums ${pnl >= 0 ? "text-gain" : "text-loss"}`}>{formatUsd(pnl)}</p>
          <p className="font-mono text-[10px] text-subtle">VS COST</p>
        </Monitor>
        <Monitor title="RECUR / MO">
          <p className="font-mono text-xl tabular-nums text-fg">{formatUsd(monthly)}</p>
        </Monitor>
        <Monitor title="RE YIELD">
          <p className="font-mono text-xl tabular-nums text-accent">{yieldRe ? `${yieldRe.toFixed(1)}%` : "—"}</p>
        </Monitor>
        <Monitor title="CASH">
          <p className="font-mono text-xl tabular-nums">{formatUsd(cashUsd)}</p>
          <p className="font-mono text-[10px] text-subtle">
            {nw ? `${((cashUsd / nw) * 100).toFixed(1)}%` : ""}
          </p>
        </Monitor>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <Monitor title="ALLOC" className="lg:col-span-2">
          <div className="flex h-2 overflow-hidden bg-raised">
            {alloc.map((b) => (
              <div
                key={b.key}
                style={{ width: `${(b.value / totalAlloc) * 100}%`, background: ALLOC_COLOR[b.key] }}
                title={b.name}
              />
            ))}
          </div>
          <table className="mt-2 w-full font-mono text-[11px]">
            <tbody>
              {alloc.map((b) => (
                <tr key={b.key} className="border-b border-border/60">
                  <td className="py-1">
                    <span className="mr-2 inline-block size-1.5" style={{ background: ALLOC_COLOR[b.key] }} />
                    {b.name}
                  </td>
                  <td className="py-1 text-right tabular-nums text-muted">
                    {((b.value / totalAlloc) * 100).toFixed(1)}%
                  </td>
                  <td className="py-1 text-right tabular-nums">{formatUsd(b.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Monitor>
        <Monitor title="MOVERS">
          {best ? (
            <Row label={best.name} value={formatPct(best.costBasis ? ((best.currentValue - best.costBasis) / best.costBasis) * 100 : 0)} up />
          ) : null}
          {worst && worst.id !== best?.id ? (
            <Row
              label={worst.name}
              value={formatPct(worst.costBasis ? ((worst.currentValue - worst.costBasis) / worst.costBasis) * 100 : 0)}
              up={false}
            />
          ) : null}
          <Row label="IN" value={formatUsd(income)} up />
          <Row label="OUT" value={formatUsd(Math.abs(expense))} up={false} />
        </Monitor>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <Monitor title="NW 12M" className="lg:col-span-2">
          <div className="h-40">
            {chart.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
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
                  <Area type="stepAfter" dataKey="value" stroke="#ff6d00" strokeWidth={1.25} fill="#ff6d00" fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="font-mono text-xs text-muted">NO SERIES</p>
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
              {transactions.slice(0, 8).map((t) => (
                <tr key={t.id} className="border-b border-border/60">
                  <td className="truncate py-1 pr-2 text-muted">{t.date.slice(5)}</td>
                  <td className="truncate py-1">{t.description}</td>
                  <td className={`py-1 text-right tabular-nums ${t.amount >= 0 ? "text-gain" : "text-loss"}`}>
                    {t.amount >= 0 ? "+" : ""}
                    {formatUsd(Math.abs(toUsd(t.amount, t.currency, fx.average)))}
                  </td>
                </tr>
              ))}
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
  wide,
  extra,
  className = "",
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-border bg-surface ${wide ? "lg:col-span-2" : ""} ${className}`}>
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
