import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AssetForm } from "@/components/asset-form";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Pager, usePager } from "@/components/pager";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import {
  deleteAsset,
  deleteRecurring,
  getAsset,
  upsertAsset,
  upsertRecurring,
} from "@/lib/server/portfolio";
import { ASSET_TYPES, CURRENCIES, FREQUENCIES, formatUsd } from "@/lib/utils";

export const Route = createFileRoute("/assets_/$id")({
  loader: async ({ params }) => getAsset({ data: { id: params.id } }),
  component: AssetDetail,
});

function AssetDetail() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [recOpen, setRecOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [recName, setRecName] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recFreq, setRecFreq] = useState("MONTHLY");
  const [recDate, setRecDate] = useState("");
  const [recCur, setRecCur] = useState("USD");

  const recPager = usePager(data?.recurring ?? [], 10);

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-muted">Activo no encontrado.</p>
        <Link to="/assets" className="mt-4 inline-flex text-sm text-fg underline">
          Volver
        </Link>
      </div>
    );
  }

  const { asset, recurring } = data;
  const pnl = asset.costBasis
    ? ((asset.currentValue - asset.costBasis) / asset.costBasis) * 100
    : 0;
  const typeLabel = ASSET_TYPES.find((t) => t.value === asset.type)?.label ?? asset.type;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/assets" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Activos
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-subtle">{typeLabel}</p>
          <h1 className="mt-1 font-mono text-xl tracking-tight text-fg">{asset.name}</h1>
          {asset.ticker ? <p className="mt-1 text-sm text-muted">{asset.ticker}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEdit(true)}>
            Editar
          </Button>
          <Button variant="danger" onClick={() => setDel(true)}>
            Eliminar
          </Button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <div className="rounded-none border border-border bg-surface p-4">
          <p className="text-xs text-subtle">Valor</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">{formatUsd(asset.currentValue)}</p>
        </div>
        <div className="rounded-none border border-border bg-surface p-4">
          <p className="text-xs text-subtle">Costo</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">{formatUsd(asset.costBasis)}</p>
        </div>
        <div className="rounded-none border border-border bg-surface p-4">
          <p className="text-xs text-subtle">P&L</p>
          <p className={`mt-2 font-mono text-2xl tabular-nums ${pnl >= 0 ? "text-gain" : "text-loss"}`}>
            {pnl >= 0 ? "+" : ""}
            {pnl.toFixed(1)}%
          </p>
        </div>
      </div>

      <section className="mt-8 rounded-none border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">Ingresos recurrentes</h2>
          <Button size="sm" variant="secondary" onClick={() => setRecOpen(true)}>
            <Plus className="size-3.5" /> Agregar
          </Button>
        </div>
        {recurring.length === 0 ? (
          <p className="py-6 text-sm text-muted">Nada programado. Alquileres y cupones van acá.</p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {recPager.slice.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-fg">{r.name}</p>
                    <p className="text-xs text-subtle">
                      {formatUsd(r.amount)} ·{" "}
                      {FREQUENCIES.find((f) => f.value === r.frequency)?.label} · próximo{" "}
                      {r.nextDate}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Eliminar ingreso"
                    onClick={async () => {
                      await deleteRecurring({ data: { id: r.id } });
                      toast.success("Ingreso eliminado");
                      await router.invalidate();
                    }}
                  >
                    <Trash2 className="size-4 text-loss" />
                  </Button>
                </li>
              ))}
            </ul>
            <Pager
              page={recPager.page}
              totalPages={recPager.totalPages}
              total={recPager.total}
              from={recPager.from}
              to={recPager.to}
              onChange={recPager.setPage}
            />
          </>
        )}
      </section>

      {asset.notes ? (
        <section className="mt-6 rounded-none border border-border bg-surface p-5">
          <h2 className="text-sm font-medium">Notas</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{asset.notes}</p>
        </section>
      ) : null}

      {edit ? (
        <AssetForm
          open
          initial={asset}
          pending={pending}
          onClose={() => setEdit(false)}
          onSubmit={async (payload) => {
            setPending(true);
            try {
              await upsertAsset({ data: payload });
              toast.success("Guardado");
              setEdit(false);
              await router.invalidate();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Error");
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}

      <ConfirmDelete
        open={del}
        title="Eliminar activo"
        body={`Se borra “${asset.name}” y sus ingresos recurrentes.`}
        pending={pending}
        onClose={() => setDel(false)}
        onConfirm={async () => {
          setPending(true);
          try {
            await deleteAsset({ data: { id: asset.id } });
            toast.success("Eliminado");
            await navigate({ to: "/assets" });
          } finally {
            setPending(false);
          }
        }}
      />

      <Dialog open={recOpen} onOpenChange={setRecOpen} title="Nuevo ingreso recurrente">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await upsertRecurring({
              data: {
                assetId: asset.id,
                name: recName,
                amount: Number(recAmount) || 0,
                currency: recCur,
                frequency: recFreq,
                nextDate: recDate || new Date().toISOString().slice(0, 10),
              },
            });
            toast.success("Ingreso agregado");
            setRecOpen(false);
            setRecName("");
            setRecAmount("");
            await router.invalidate();
          }}
        >
          <Field label="Concepto">
            <Input required value={recName} onChange={(e) => setRecName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto">
              <Input
                required
                type="number"
                step="any"
                value={recAmount}
                onChange={(e) => setRecAmount(e.target.value)}
              />
            </Field>
            <Field label="Moneda">
              <Select value={recCur} onChange={(e) => setRecCur(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Frecuencia">
            <Select value={recFreq} onChange={(e) => setRecFreq(e.target.value)}>
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Próxima fecha">
            <Input type="date" value={recDate} onChange={(e) => setRecDate(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
