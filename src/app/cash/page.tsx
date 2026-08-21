"use client";

import { useState } from "react";
import { cashAccounts, exchangeRate } from "@/lib/mock-data";
import { formatUSD, formatNumber } from "@/lib/utils";
import { Wallet, Building2, Landmark, Smartphone, Banknote, Plus } from "lucide-react";
import { AddAccountModal } from "@/components/AddAccountModal";

const typeIcons: Record<string, React.ReactNode> = {
  bank: <Building2 className="h-4 w-4" />,
  broker: <Landmark className="h-4 w-4" />,
  exchange: <Smartphone className="h-4 w-4" />,
  physical: <Banknote className="h-4 w-4" />,
  wallet: <Wallet className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  bank: "bg-blue-500/15 text-blue-400",
  broker: "bg-indigo-500/15 text-indigo-400",
  exchange: "bg-amber-500/15 text-amber-400",
  physical: "bg-emerald-500/15 text-emerald-400",
  wallet: "bg-violet-500/15 text-violet-400",
};

export default function CashPage() {
  const [showAdd, setShowAdd] = useState(false);
  const totalUsd = cashAccounts.reduce((sum, a) => sum + a.balanceUsd, 0);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Cuentas de Cash</h1>
          <p className="mt-1 text-sm text-zinc-400">Todas tus cuentas de efectivo y saldos disponibles</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400">
          <Plus className="h-4 w-4" /> Agregar Cuenta
        </button>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <div className="flex items-center gap-2 text-zinc-400"><Wallet className="h-4 w-4" /><span className="text-sm font-medium">Total Cash (USD)</span></div>
          <p className="mt-2 text-3xl font-bold text-white">{formatUSD(totalUsd)}</p>
          <p className="mt-1 text-xs text-zinc-500">Convertido con promedio de tipos de cambio</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <p className="text-sm font-medium text-zinc-400">Cuentas activas</p>
          <p className="mt-2 text-3xl font-bold text-white">{cashAccounts.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <p className="text-sm font-medium text-zinc-400">Tipo de cambio usado</p>
          <p className="mt-2 text-3xl font-bold text-white">${formatNumber(exchangeRate.average, 0)}</p>
          <p className="mt-1 text-xs text-zinc-500">Promedio Oficial + Blue + MEP</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Mis cuentas</h2>
        {cashAccounts.map((account) => (
          <div key={account.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#12141c] px-5 py-4 transition-colors hover:border-zinc-700">
            <div className="flex items-center gap-4">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${typeColors[account.type]}`}>{typeIcons[account.type]}</span>
              <div>
                <p className="font-medium text-zinc-100">{account.name}</p>
                <p className="text-xs text-zinc-500">{account.institution} · {account.currency}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-white">
                {account.currency === "USD" || account.currency === "USDT" ? formatUSD(account.balance) : `$ ${formatNumber(account.balance, 0)} ${account.currency}`}
              </p>
              {account.currency !== "USD" && account.currency !== "USDT" && (
                <p className="text-xs text-zinc-500">≈ {formatUSD(account.balanceUsd)}</p>
              )}
              <p className="mt-0.5 text-xs text-zinc-600">{account.lastUpdated}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-zinc-600">Los saldos se muestran en moneda original. El Total Cash es convertido a USD usando el promedio de Oficial + Blue + MEP.</p>
      <AddAccountModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
