"use client";

import { useState } from "react";
import { assets as initialAssets } from "@/lib/mock-data";
import { formatUSD, formatPercent, cn } from "@/lib/utils";
import { Bitcoin, BarChart3, Building2, Landmark, Eye, Plus, Pencil } from "lucide-react";
import Link from "next/link";
import { AddAssetModal } from "@/components/AddAssetModal";
import { EditAssetModal } from "@/components/EditAssetModal";

const filters = ["All", "CRYPTO", "STOCK", "BOND", "REAL_ESTATE"] as const;

const typeLabels: Record<string, string> = {
  CRYPTO: "Crypto",
  STOCK: "Stocks",
  BOND: "Bonds",
  REAL_ESTATE: "Real Estate",
};

const typeColors: Record<string, string> = {
  CRYPTO: "bg-violet-500/15 text-violet-400",
  STOCK: "bg-blue-500/15 text-blue-400",
  BOND: "bg-amber-500/15 text-amber-400",
  REAL_ESTATE: "bg-teal-500/15 text-teal-400",
};

const typeIcons: Record<string, React.ReactNode> = {
  CRYPTO: <Bitcoin className="h-4 w-4" />,
  STOCK: <BarChart3 className="h-4 w-4" />,
  BOND: <Landmark className="h-4 w-4" />,
  REAL_ESTATE: <Building2 className="h-4 w-4" />,
};

type Asset = (typeof initialAssets)[0];

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [showAdd, setShowAdd] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const filtered = filter === "All" ? assets : assets.filter((a) => a.type === filter);
  const totalValue = filtered.reduce((sum, a) => sum + a.currentValue, 0);

  const handleSave = (updated: Asset) => {
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleDelete = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAdd = (data: any) => {
    const cost = parseFloat(data.costBasis) || 0;
    const qty = data.quantity ? parseFloat(data.quantity) : 1;
    const newAsset: Asset = {
      id: `new-${Date.now()}`,
      name: data.name,
      ticker: data.ticker || null,
      type: data.type,
      quantity: qty,
      costBasis: cost,
      currentValue: cost,
      pnlPercent: 0,
      currency: data.currency || "USD",
    };
    setAssets((prev) => [...prev, newAsset]);
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Mis Assets</h1>
          <p className="mt-1 text-sm text-zinc-400">{filtered.length} assets • Total {formatUSD(totalValue)}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400">
          <Plus className="h-4 w-4" /> Agregar Asset
        </button>
      </div>

      <div className="mb-6 flex gap-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors", filter === f ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30" : "bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200")}>
            {f === "All" ? "All" : typeLabels[f]}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#12141c]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              <th className="px-6 py-4 font-medium">Asset</th>
              <th className="px-4 py-4 font-medium">Tipo</th>
              <th className="px-4 py-4 font-medium text-right">Cantidad</th>
              <th className="px-4 py-4 font-medium text-right">Valor Actual</th>
              <th className="px-4 py-4 font-medium text-right">Costo</th>
              <th className="px-4 py-4 font-medium text-right">P&L %</th>
              <th className="px-6 py-4 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {filtered.map((asset) => (
              <tr key={asset.id} className="text-sm transition-colors hover:bg-zinc-800/30">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", typeColors[asset.type])}>{typeIcons[asset.type]}</span>
                    <div>
                      <p className="font-medium text-zinc-100">{asset.name}</p>
                      {asset.ticker && <p className="text-xs text-zinc-500">{asset.ticker}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", typeColors[asset.type])}>{typeLabels[asset.type]}</span></td>
                <td className="px-4 py-4 text-right text-zinc-300">{asset.quantity ?? "—"}</td>
                <td className="px-4 py-4 text-right font-medium text-white">{formatUSD(asset.currentValue)}</td>
                <td className="px-4 py-4 text-right text-zinc-400">{formatUSD(asset.costBasis)}</td>
                <td className={cn("px-4 py-4 text-right font-medium", asset.pnlPercent >= 0 ? "text-emerald-400" : "text-red-400")}>{formatPercent(asset.pnlPercent)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setEditingAsset(asset)} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <Link href={`/assets/${asset.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white">
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="py-16 text-center text-sm text-zinc-500">No hay assets en esta categoría</div>}
      </div>

      <AddAssetModal open={showAdd} onClose={() => setShowAdd(false)} onSave={handleAdd} />
      <EditAssetModal open={!!editingAsset} asset={editingAsset} onClose={() => setEditingAsset(null)} onSave={handleSave} onDelete={handleDelete} />
    </div>
  );
}
