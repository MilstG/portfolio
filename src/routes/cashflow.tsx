import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { addTransaction, deleteTransaction, getPortfolio } from "@/lib/server/portfolio";
import { CURRENCIES, TX_TYPES, formatUsd, toUsd } from "@/lib/utils";

export const Route = createFileRoute("/cashflow")({
  loader: () => getPortfolio(),
  component: CashflowPage,
});

function CashflowPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("EXPENSE");
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("");

  const { income, expense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of data.transactions) {
      const v = toUsd(t.amount, t.currency, data.fx.average);
      if (v >= 0) income += v;
      else expense += v;
    }
    return { income, expense };
  }, [data]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-sm tracking-widest text-accent">FLUJO</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-3.5" /> ADD
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="border border-border bg-surface p-2">
          <p className="font-mono text-[10px] tracking-widest text-accent">IN</p>
          <p className="font-mono text-sm tabular-nums text-gain">{formatUsd(income)}</p>
        </div>
        <div className="border border-border bg-surface p-2">
          <p className="font-mono text-[10px] tracking-widest text-accent">OUT</p>
          <p className="font-mono text-sm tabular-nums text-loss">{formatUsd(Math.abs(expense))}</p>
        </div>
        <div className="border border-border bg-surface p-2">
          <p className="font-mono text-[10px] tracking-widest text-accent">NET</p>
          <p className="font-mono text-sm tabular-nums">{formatUsd(income + expense)}</p>
        </div>
      </div>

      <ul className="mt-2 divide-y divide-border border border-border bg-surface font-mono text-xs">
        {data.transactions.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 px-2 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-fg">{t.description}</p>
              <p className="text-[10px] text-subtle">
                {t.date} · {t.category || t.type}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <p className={`tabular-nums ${t.amount >= 0 ? "text-gain" : "text-loss"}`}>
                {t.amount >= 0 ? "+" : ""}
                {formatUsd(Math.abs(toUsd(t.amount, t.currency, data.fx.average)))}
              </p>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Eliminar movimiento"
                onClick={async () => {
                  await deleteTransaction({ data: { id: t.id } });
                  toast.success("Eliminado");
                  await router.invalidate();
                }}
              >
                <Trash2 className="size-4 text-loss" />
              </Button>
            </div>
          </li>
        ))}
        {data.transactions.length === 0 ? (
          <li className="py-16 text-center text-sm text-muted">Sin movimientos.</li>
        ) : null}
      </ul>

      <Dialog open={open} onOpenChange={setOpen} title="Nuevo movimiento">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const raw = Number(amount) || 0;
            const signed =
              type === "EXPENSE" || type === "BUY" || type === "TRANSFER" ? -Math.abs(raw) : Math.abs(raw);
            await addTransaction({
              data: {
                description: desc,
                amount: signed,
                currency,
                type,
                category: category || type,
                date,
              },
            });
            toast.success("Registrado");
            setOpen(false);
            setDesc("");
            setAmount("");
            await router.invalidate();
          }}
        >
          <Field label="Descripción">
            <Input required value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto (positivo)">
              <Input required type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Moneda">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Tipo">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {TX_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Categoría">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Housing, Food…" />
          </Field>
          <div className="flex justify-end">
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
