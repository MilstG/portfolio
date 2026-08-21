import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ASSET_TYPES, CURRENCIES } from "@/lib/utils";
import type { Asset } from "@/lib/types";

export type AssetPayload = {
  id?: string;
  name: string;
  ticker?: string | null;
  type: string;
  quantity: number | null;
  costBasis: number;
  currentValue: number;
  currency: string;
  purchaseDate?: string | null;
  notes?: string | null;
};

export function AssetForm({
  open,
  onClose,
  initial,
  onSubmit,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Asset | null;
  onSubmit: (data: AssetPayload) => Promise<void>;
  pending?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ticker, setTicker] = useState(initial?.ticker ?? "");
  const [type, setType] = useState(initial?.type ?? "CRYPTO");
  const [quantity, setQuantity] = useState(initial?.quantity?.toString() ?? "");
  const [costBasis, setCostBasis] = useState(initial?.costBasis?.toString() ?? "");
  const [currentValue, setCurrentValue] = useState(initial?.currentValue?.toString() ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // reset when opening a different asset
  const key = initial?.id ?? "new";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={initial ? "Editar activo" : "Nuevo activo"}
      description="Los cambios se guardan en la base de datos."
    >
      <form
        key={key}
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await onSubmit({
            id: initial?.id,
            name,
            ticker: ticker || null,
            type,
            quantity: quantity === "" ? 1 : Number(quantity),
            costBasis: Number(costBasis) || 0,
            currentValue: Number(currentValue) || 0,
            currency,
            purchaseDate: purchaseDate || null,
            notes: notes || null,
          });
        }}
      >
        <Field label="Nombre">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Moneda">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ticker">
            <Input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="BTC" />
          </Field>
          <Field label="Cantidad">
            <Input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Costo total">
            <Input
              required
              type="number"
              step="any"
              value={costBasis}
              onChange={(e) => setCostBasis(e.target.value)}
            />
          </Field>
          <Field label="Valor actual">
            <Input
              required
              type="number"
              step="any"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Fecha de compra">
          <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </Field>
        <Field label="Notas">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
