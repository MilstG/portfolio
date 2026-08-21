"use client";

import { cashflowSummary, expenseCategories, recentTransactions } from "@/lib/mock-data";
import { formatUSD, formatPercent } from "@/lib/utils";
import { TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export default function CashflowPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Cashflow</h1>
        <p className="mt-1 text-sm text-zinc-400">Ingresos, gastos y flujo de caja del mes</p>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <div className="flex items-center gap-2 text-emerald-400"><ArrowDownLeft className="h-4 w-4" /><span className="text-sm font-medium">Ingresos</span></div>
          <p className="mt-2 text-3xl font-bold text-white">{formatUSD(cashflowSummary.income)}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400"><TrendingUp className="h-3 w-3" />{formatPercent(cashflowSummary.incomeChange)} vs mes anterior</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <div className="flex items-center gap-2 text-red-400"><ArrowUpRight className="h-4 w-4" /><span className="text-sm font-medium">Gastos</span></div>
          <p className="mt-2 text-3xl font-bold text-white">{formatUSD(cashflowSummary.expenses)}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-red-400"><TrendingDown className="h-3 w-3" />{formatPercent(cashflowSummary.expensesChange)} vs mes anterior</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <div className="flex items-center gap-2 text-blue-400"><TrendingUp className="h-4 w-4" /><span className="text-sm font-medium">Neto</span></div>
          <p className="mt-2 text-3xl font-bold text-white">{formatUSD(cashflowSummary.net)}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400"><TrendingUp className="h-3 w-3" />{formatPercent(cashflowSummary.netChange)} vs mes anterior</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <h3 className="mb-4 text-sm font-medium text-zinc-300">Gastos por categoría</h3>
          <div className="mb-6 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseCategories} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                  {expenseCategories.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [formatUSD(value), ""]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {expenseCategories.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm text-zinc-300">{cat.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{formatUSD(cat.value)}</p>
                  <p className="text-xs text-zinc-500">{cat.percent}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-3 rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <h3 className="mb-4 text-sm font-medium text-zinc-300">Transacciones del mes</h3>
          <div className="space-y-1">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-zinc-800/40">
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tx.amount >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                    {tx.amount >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{tx.description}</p>
                    <p className="text-xs text-zinc-500">{tx.date} · {tx.category}</p>
                  </div>
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
