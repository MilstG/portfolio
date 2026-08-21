"use client";

import { useState } from "react";
import { X, Save } from "lucide-react";

const ACCOUNT_TYPES = [
  { value: "bank", label: "Banco" },
  { value: "broker", label: "Broker" },
  { value: "exchange", label: "Exchange / Crypto" },
  { value: "wallet", label: "Wallet" },
  { value: "physical", label: "Efectivo físico" },
];

const CURRENCIES = ["USD", "ARS", "USDT", "EUR"];

interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
}

export function AddAccountModal({ open, onClose, onSave }: AddAccountModalProps) {
  const [form, setForm] = useState({
    name: "",
    institution: "",
    type: "bank",
    currency: "USD",
    balance: "",
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
      name: "",
      institution: "",
      type: "bank",
      currency: "USD",
      balance: "",
      notes: "",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#12141c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Agregar Cuenta</h2>
            <p className="text-xs text-zinc-500">Nueva cuenta de cash</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Nombre de la cuenta
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Ej: Banco Galicia ARS, Binance USDT..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Tipo
              </label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
              >
                {ACCOUNT_TYPES.map((t) => (
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
              Institución
            </label>
            <input
              name="institution"
              value={form.institution}
              onChange={handleChange}
              placeholder="Banco Galicia, Binance, Interactive Brokers..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Saldo actual
            </label>
            <input
              name="balance"
              type="number"
              step="any"
              value={form.balance}
              onChange={handleChange}
              required
              placeholder="4200"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500"
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            <Save className="h-4 w-4" />
            Guardar Cuenta
          </button>
        </form>
      </div>
    </div>
  );
}
