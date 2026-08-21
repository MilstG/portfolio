"use client";

import { useState, useEffect } from "react";
import { X, Save, Trash2 } from "lucide-react";

const ASSET_TYPES = [
  { value: "CRYPTO", label: "Crypto" },
  { value: "STOCK", label: "Stock / ETF" },
  { value: "BOND", label: "Bono" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "OTHER", label: "Otro" },
];

const CURRENCIES = ["USD", "ARS", "USDT", "EUR"];

interface Asset {
  id: string;
  name: string;
  ticker: string | null;
  type: string;
  quantity: number | null;
  costBasis: number;
  currentValue: number;
  pnlPercent: number;
  currency: string;
}

interface EditAssetModalProps {
  open: boolean;
  asset: Asset | null;
  onClose: () => void;
  onSave: (asset: Asset) => void;
  onDelete: (id: string) => void;
}

export function EditAssetModal({ open, asset, onClose, onSave, onDelete }: EditAssetModalProps) {
  const [form, setForm] = useState({
    name: "",
    ticker: "",
    type: "CRYPTO",
    quantity: "",
    costBasis: "",
    currentValue: "",
    currency: "USD",
  });

  useEffect(() => {
    if (asset) {
      setForm({
        name: asset.name,
        ticker: asset.ticker || "",
        type: asset.type,
        quantity: asset.quantity?.toString() || "",
        costBasis: asset.costBasis.toString(),
        currentValue: asset.currentValue.toString(),
        currency: asset.currency,
      });
    }
  }, [asset]);

  if (!open || !asset) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(form.costBasis) || 0;
    const current = parseFloat(form.currentValue) || 0;
    const pnl = cost > 0 ? ((current - cost) / cost) * 100 : 0;

    onSave({
      ...asset,
      name: form.name,
      ticker: form.ticker || null,
      type: form.type,
      quantity: form.quantity ? parseFloat(form.quantity) : null,
      costBasis: cost,
      currentValue: current,
      pnlPercent: Math.round(pnl * 10) / 10,
      currency: form.currency,
    });
    onClose();
  };

  const handleDelete = () => {
    if (confirm(`¿Eliminar "${asset.name}"? Esta acción no se puede deshacer.`)) {
      onDelete(asset.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#12141c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Editar Asset</h2>
            <p className="text-xs text-zinc-500">{asset.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Tipo</label>
              <select name="type" value={form.type} onChange={handleChange}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500">
                {ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Moneda</label>
              <select name="currency" value={form.currency} onChange={handleChange}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Nombre</label>
            <input name="name" value={form.name} onChange={handleChange} required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Ticker</label>
              <input name="ticker" value={form.ticker} onChange={handleChange}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Cantidad</label>
              <input name="quantity" type="number" step="any" value={form.quantity} onChange={handleChange}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Costo total</label>
              <input name="costBasis" type="number" step="any" value={form.costBasis} onChange={handleChange} required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Valor actual</label>
              <input name="currentValue" type="number" step="any" value={form.currentValue} onChange={handleChange} required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleDelete}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/20">
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
            <button type="submit"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white hover:bg-emerald-400">
              <Save className="h-4 w-4" /> Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
