import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ACCOUNT_TYPES, CURRENCIES } from "@/lib/utils";
import type { Account } from "@/lib/types";

export type AccountPayload = {
  id?: string;
  name: string;
  institution?: string | null;
  type: string;
  currency: string;
  balance: number;
  notes?: string | null;
};

export function AccountForm({
  open,
  onClose,
  initial,
  onSubmit,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Account | null;
  onSubmit: (data: AccountPayload) => Promise<void>;
  pending?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [type, setType] = useState(initial?.type ?? "bank");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [balance, setBalance] = useState(initial?.balance?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const key = initial?.id ?? "new";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={initial ? "Editar cuenta" : "Nueva cuenta"}
      description="Cada cuenta se guarda por separado en la base."
    >
      <form
        key={key}
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await onSubmit({
            id: initial?.id,
            name,
            institution: institution || null,
            type,
            currency,
            balance: Number(balance) || 0,
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
              {ACCOUNT_TYPES.map((t) => (
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
        <Field label="Institución">
          <Input value={institution} onChange={(e) => setInstitution(e.target.value)} />
        </Field>
        <Field label="Saldo">
          <Input
            required
            type="number"
            step="any"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
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
