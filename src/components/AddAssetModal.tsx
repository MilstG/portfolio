"use client";

import { useState } from "react";
import { X, Save } from "lucide-react";

const ASSET_TYPES = [
  { value: "CRYPTO", label: "Crypto" },
  { value: "STOCK", label: "Stock / ETF" },
  { value: "BOND", label: "Bono" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "OTHER", label: "Otro" },
];

const CURRENCIES = ["USD", "ARS", "USDT", "EUR"];

interface AddAssetModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
}

export function AddAssetModal({ open, onClose, onSave }: AddAssetModalProps) {
  const [form, setForm] = useState({
    type: "CRYPTO",
    name: "",
    ticker: "",
    quantity: "",
    costBasis: "",
    purchaseDate: "",
    currency: "USD",
    notes: "",
  });

  if (!open) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.(form);
    onClose();
    setForm({
      type: "CRYPTO",
      name: "",
      ticker: "",
      quantity: "",
      costBasis: "",
      purchaseDate: "",
      currency: "USD",
      notes: "",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#12141c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Agregar Asset</h2>
            <p className="text-xs text-zinc-500">
              Completá los detalles de tu nuevo activo
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Tipo de Asset
              </label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Moneda
              </label>
              <select
                name="currency"
                value={form.currency}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Nombre / Ticker
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Ej: Bitcoin, Apple, AL30, Departamento Palermo..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Cantidad
              </label>
              <input
                name="quantity"
                type="number"
                step="any"
                value={form.quantity}
                onChange={handleChange}
                placeholder="0.85"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Precio / Costo total
              </label>
              <input
                name="costBasis"
                type="number"
                step="any"
                value={form.costBasis}
                onChange={handleChange}
                required
                placeholder="44350"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Fecha de compra
            </label>
            <input
              name="purchaseDate"
              type="date"
              value={form.purchaseDate}
              onChange={handleChange}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Notas (opcional)
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Comprado en Binance, fee 0.1%..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
          >
            <Save className="h-4 w-4" />
            Guardar Asset
          </button>
        </form>

        <p className="pb-4 text-center text-xs text-zinc-600">
          Tus datos están seguros
        </p>
      </div>
    </div>
  );
}
