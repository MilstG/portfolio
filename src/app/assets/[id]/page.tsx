"use client";

import { use } from "react";
import { assets } from "@/lib/mock-data";
import { formatUSD, formatPercent } from "@/lib/utils";
import { ArrowLeft, Building2, Bitcoin, BarChart3, Landmark, Calendar, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

const typeIcons: Record<string, React.ReactNode> = {
  CRYPTO: <Bitcoin className="h-5 w-5" />,
  STOCK: <BarChart3 className="h-5 w-5" />,
  BOND: <Landmark className="h-5 w-5" />,
  REAL_ESTATE: <Building2 className="h-5 w-5" />,
};

const recurringData: Record<string, { name: string; amount: number; frequency: string; nextDate: string; ytd: number; upcoming: { date: string; amount: number; status: string }[] }> = {
  "apto-caba": {
    name: "Alquiler Mensual",
    amount: 1200,
    frequency: "Mensual",
    nextDate: "1 Sep 2026",
    ytd: 9600,
    upcoming: [
      { date: "1 Sep 2026", amount: 1200, status: "Programado" },
      { date: "1 Oct 2026", amount: 1200, status: "Programado" },
      { date: "1 Ago 2026", amount: 1200, status: "Recibido" },
      { date: "1 Jul 2026", amount: 1200, status: "Recibido" },
    ],
  },
  al30: {
    name: "Cupón AL30",
    amount: 275,
    frequency: "Semestral",
    nextDate: "15 Ene 2027",
    ytd: 275,
    upcoming: [
      { date: "15 Ene 2027", amount: 275, status: "Programado" },
      { date: "15 Jul 2026", amount: 275, status: "Recibido" },
    ],
  },
};

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const asset = assets.find((a) => a.id === id);
  const recurring = recurringData[id];

  if (!asset) {
    return (
      <div className="p-8">
        <p className="text-zinc-400">Asset no encontrado</p>
        <Link href="/assets" className="mt-4 text-emerald-400">← Volver</Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Link href="/assets" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" /> Volver a Assets
      </Link>

      <div className="mb-8 flex items-start gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-200">{typeIcons[asset.type]}</span>
        <div>
          <h1 className="text-2xl font-semibold text-white">{asset.name}</h1>
          {asset.ticker && <p className="text-sm text-zinc-400">{asset.ticker}</p>}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-5">
          <p className="text-sm text-zinc-400">Valor Actual</p>
          <p className="mt-1 text-2xl font-bold text-white">{formatUSD(asset.currentValue)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-5">
          <p className="text-sm text-zinc-400">Costo de Adquisición</p>
          <p className="mt-1 text-2xl font-bold text-white">{formatUSD(asset.costBasis)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-5">
          <p className="text-sm text-zinc-400">P&L</p>
          <p className={`mt-1 text-2xl font-bold ${asset.pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatPercent(asset.pnlPercent)}</p>
        </div>
      </div>

      {recurring ? (
        <div className="rounded-2xl border border-zinc-800 bg-[#12141c] p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-300">Ingresos Recurrentes</h2>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">Active</span>
          </div>
          <div className="mb-6 grid grid-cols-4 gap-4">
            <div><p className="text-xs text-zinc-500">Concepto</p><p className="mt-1 font-medium text-white">{recurring.name}</p></div>
            <div><p className="text-xs text-zinc-500">Monto</p><p className="mt-1 font-medium text-white">{formatUSD(recurring.amount)}</p></div>
            <div><p className="text-xs text-zinc-500">Frecuencia</p><p className="mt-1 font-medium text-white">{recurring.frequency}</p></div>
            <div><p className="text-xs text-zinc-500">Próximo pago</p><p className="mt-1 font-medium text-white">{recurring.nextDate}</p></div>
          </div>
          <p className="mb-3 text-xs text-zinc-500">Recibido este año: <span className="font-medium text-emerald-400">{formatUSD(recurring.ytd)}</span></p>
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {recurring.upcoming.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-zinc-300"><div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-zinc-500" />{item.date}</div></td>
                    <td className="px-4 py-3 font-medium text-white">{formatUSD(item.amount)}</td>
                    <td className="px-4 py-3">
                      {item.status === "Recibido" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Recibido</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-400"><Clock className="h-3.5 w-3.5" /> Programado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-[#12141c]/50 p-8 text-center">
          <p className="text-sm text-zinc-500">Este asset no tiene ingresos recurrentes configurados.</p>
        </div>
      )}
    </div>
  );
}
