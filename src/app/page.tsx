"use client";

import {
  netWorth, allocation, netWorthHistory, recentTransactions, assets,
} from "@/lib/mock-data";
import { formatUSD, formatPercent } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, Bitcoin, BarChart3, Building2, Wallet, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

const typeIcons: Record<string, React.ReactNode> = {
  Crypto: <Bitcoin className="h-4 w-4" />,
  Stocks: <BarChart3 className="h-4 w-4" />,
  "Real Estate": <Building2 className="h-4 w-4" />,
  Cash: <Wallet className="h-4 w-4" />,
};

const totalCost = assets.reduce((s, a) => s + a.costBasis, 0);
const totalPnl = netWorth.totalUsd - totalCost - 9450;
const bestAsset = [...assets].sort((a, b) => b.pnlPercent - a.pnlPercent)[0];
const worstAsset = [...assets].sort((a, b) => a.pnlPercent - b.pnlPercent)[0];
const realEstateYield = (1200 * 12) / 35000 * 100;
const bondYield = (275 * 2) / 5125 * 100;
const monthlyRecurring = 1200 + 275 / 6;

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">Resumen de tu patrimonio • Agosto 2026</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-5">
          <p className="text-xs font-medium text-zinc-500">Net Worth</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-white">{formatUSD(netWorth.totalUsd)}</p>
          <div className="mt-2 flex items-center gap-1.5 text-sm text-emerald-400">
            <TrendingUp className="h-4 w-4" />{formatPercent(netWorth.changePercent)} este mes
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-5">
          <p className="text-xs font-medium text-zinc-500">P&L Total</p>
          <p className={`mt-1 text-3xl font-bold tracking-tight ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalPnl >= 0 ? "+" : ""}{formatUSD(totalPnl)}
          </p>
          <p className="mt-2 text-xs text-zinc-500">vs costo de adquisición</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-5">
          <p className="text-xs font-medium text-zinc-500">Ingreso recurrente / mes</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-white">{formatUSD(monthlyRecurring)}</p>
          <p className="mt-2 text-xs text-zinc-500">Alquiler + cupones estimados</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-5">
          <p className="text-xs font-medium text-zinc-500">Yield Real Estate</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-teal-400">{realEstateYield.toFixed(1)}%</p>
          <p className="mt-2 text-xs text-zinc-500">Anual bruto estimado</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        {allocation.map((item) => (
          <div key={item.name} className="rounded-xl border border-zinc-800 bg-[#12141c] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${item.color}22` }}>
                  <span style={{ color: item.color }}>{typeIcons[item.name]}</span>
                </span>
                <span className="text-sm font-medium text-zinc-300">{item.name}</span>
              </div>
              <span className="text-xs text-zinc-500">{item.percent}%</span>
            </div>
            <p className="mt-3 text-xl font-semibold text-white">{formatUSD(item.value)}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <h3 className="mb-4 text-sm font-medium text-zinc-300">Evolución del patrimonio (12 meses)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthHistory}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis hide domain={["dataMin - 5000", "dataMax + 5000"]} />
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [formatUSD(value), "Net Worth"]} />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-5">
            <p className="text-xs font-medium text-zinc-500">Mejor performer</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-medium text-white">{bestAsset.name}</p>
              <span className="flex items-center gap-1 text-sm font-semibold text-emerald-400">
                <ArrowUpRight className="h-4 w-4" />{formatPercent(bestAsset.pnlPercent)}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-5">
            <p className="text-xs font-medium text-zinc-500">Peor performer</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-medium text-white">{worstAsset.name}</p>
              <span className="flex items-center gap-1 text-sm font-semibold text-red-400">
                <ArrowDownRight className="h-4 w-4" />{formatPercent(worstAsset.pnlPercent)}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-5">
            <p className="text-xs font-medium text-zinc-500">Yield Bono AL30</p>
            <p className="mt-1 text-2xl font-bold text-amber-400">{bondYield.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-zinc-500">Anual estimado por cupones</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <h3 className="mb-4 text-sm font-medium text-zinc-300">Asset Allocation</h3>
          <div className="flex items-center gap-6">
            <div className="h-40 w-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                    {allocation.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2.5">
              {allocation.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-zinc-300">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium text-white">{formatUSD(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-3 rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-300">Transacciones recientes</h3>
            <a href="/cashflow" className="text-xs font-medium text-emerald-400 hover:text-emerald-300">Ver todas →</a>
          </div>
          <div className="space-y-1">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-zinc-800/40">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{tx.description}</p>
                  <p className="text-xs text-zinc-500">{tx.date} · {tx.category}</p>
                </div>
                <p className={`text-sm font-semibold ${tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {tx.amount >= 0 ? "+" : ""}{formatUSD(Math.abs(tx.amount))}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
