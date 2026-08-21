"use client";

import {
  netWorth,
  allocation,
  netWorthHistory,
  recentTransactions,
} from "@/lib/mock-data";
import { formatUSD, formatPercent } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, Bitcoin, BarChart3, Building2, Wallet } from "lucide-react";

const typeIcons: Record<string, React.ReactNode> = {
  Crypto: <Bitcoin className="h-4 w-4" />,
  Stocks: <BarChart3 className="h-4 w-4" />,
  "Real Estate": <Building2 className="h-4 w-4" />,
  Cash: <Wallet className="h-4 w-4" />,
};

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">Resumen de tu patrimonio • Agosto 2026</p>
      </div>

      <div className="mb-8 rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
        <p className="text-sm font-medium text-zinc-400">Net Worth</p>
        <div className="mt-1 flex items-baseline gap-3">
          <h2 className="text-4xl font-bold tracking-tight text-white">{formatUSD(netWorth.totalUsd)}</h2>
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-400">
            <TrendingUp className="h-4 w-4" />
            {formatPercent(netWorth.changePercent)} este mes
          </span>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-4 gap-4">
        {allocation.map((item) => (
          <div key={item.name} className="rounded-xl border border-zinc-800 bg-[#12141c] p-5">
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${item.color}22` }}>
                <span style={{ color: item.color }}>{typeIcons[item.name]}</span>
              </span>
              <span className="text-sm font-medium">{item.name}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">{formatUSD(item.value)}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{item.percent}% del patrimonio</p>
          </div>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-6">
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <h3 className="mb-4 text-sm font-medium text-zinc-300">Asset Allocation</h3>
          <div className="flex items-center gap-8">
            <div className="h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {allocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {allocation.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-zinc-300">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{formatUSD(item.value)}</p>
                    <p className="text-xs text-zinc-500">{item.percent}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <h3 className="mb-4 text-sm font-medium text-zinc-300">Net Worth (12 meses)</h3>
          <div className="h-48">
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
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-300">Transacciones recientes</h3>
          <a href="/cashflow" className="text-xs font-medium text-emerald-400 hover:text-emerald-300">Ver todas →</a>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              <th className="pb-3 font-medium">Fecha</th>
              <th className="pb-3 font-medium">Descripción</th>
              <th className="pb-3 font-medium">Categoría</th>
              <th className="pb-3 font-medium text-right">Monto</th>
              <th className="pb-3 font-medium text-right">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {recentTransactions.map((tx) => (
              <tr key={tx.id} className="text-sm">
                <td className="py-3 text-zinc-400">{tx.date}</td>
                <td className="py-3 font-medium text-zinc-200">{tx.description}</td>
                <td className="py-3"><span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">{tx.category}</span></td>
                <td className={`py-3 text-right font-medium ${tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {tx.amount >= 0 ? "+" : ""}{formatUSD(Math.abs(tx.amount))}
                </td>
                <td className="py-3 text-right text-zinc-500">{tx.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
