import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AssetForm } from "@/components/asset-form";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Monitor, PageHeader } from "@/components/ui/monitor";
import { Pager, usePager } from "@/components/ui/pager";
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
      <div className="mx-auto max-w-3xl font-mono text-xs">
        <p className="text-muted">Activo no encontrado.</p>
        <Link to="/assets" className="mt-4 inline-flex text-accent underline">
          Volver a POS
        </Link>
      </div>
    );
  }

  const { asset, recurring } = data;
  const pnl = asset.costBasis
    ? ((asset.currentValue - asset.costBasis) / asset.costBasis) * 100
    : 0;
  const typeLabel =
    ASSET_TYPES.find((t) => t.value === asset.type)?.label ?? asset.type;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2">
      <Link
        to="/assets"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-widest text-muted hover:text-accent"
      >
        <ArrowLeft className="size-3.5" /> POS
      </Link>
      <PageHeader
        title={asset.name}
        meta={
          <p className="font-mono text-[11px] text-muted">
            {typeLabel}
            {asset.ticker ? ` · ${asset.ticker}` : ""} · {asset.currency}
          </p>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setEdit(true)}>
              Editar
            </Button>
            <Button variant="danger" onClick={() => setDel(true)}>
              Eliminar
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        <Monitor title="VALUE">
          <p className="font-mono text-lg tabular-nums md:text-2xl">
            {formatUsd(asset.currentValue)}
          </p>
        </Monitor>
        <Monitor title="COST">
          <p className="font-mono text-lg tabular-nums text-muted md:text-2xl">
            {formatUsd(asset.costBasis)}
          </p>
        </Monitor>
        <Monitor title="P&L">
          <p
            className={`font-mono text-lg tabular-nums md:text-2xl ${pnl >= 0 ? "text-gain" : "text-loss"}`}
          >
            {pnl >= 0 ? "+" : ""}
            {pnl.toFixed(1)}%
          </p>
          <p className="font-mono text-[11px] text-muted">
            {formatUsd(asset.currentValue - asset.costBasis)}
          </p>
        </Monitor>
      </div>

      <Monitor
        title="RECURRING"
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setRecOpen(true)}
          >
            <Plus className="size-3.5" /> Agregar
          </Button>
        }
      >
        {recurring.length === 0 ? (
          <p className="py-6 text-center font-mono text-xs text-muted">
            Nada programado. Alquileres y cupones van acá.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border/50 font-mono text-[12px]">
              {recPager.slice.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-fg">{r.name}</p>
                    <p className="text-[11px] text-subtle">
                      {formatUsd(r.amount)} ·{" "}
                      {FREQUENCIES.find((f) => f.value === r.frequency)?.label}{" "}
                      · próximo {r.nextDate}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Eliminar ingreso"
                    onClick={async () => {
                      try {
                        await deleteRecurring({ data: { id: r.id } });
                        toast.success("Ingreso eliminado");
                        await router.invalidate();
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Error",
                        );
                      }
                    }}
                  >
                    <Trash2 className="size-3.5 text-loss" />
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
              className="mt-1"
            />
          </>
        )}
      </Monitor>

      {asset.notes ? (
        <Monitor title="NOTES">
          <p className="font-mono text-xs whitespace-pre-wrap text-muted">
            {asset.notes}
          </p>
        </Monitor>
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
            // Without this the list (and the dashboard behind it) can still be
            // inside its stale window and show the asset that was just deleted.
            await router.invalidate();
            await navigate({ to: "/assets" });
          } finally {
            setPending(false);
          }
        }}
      />

      <Dialog
        open={recOpen}
        onOpenChange={setRecOpen}
        title="Nuevo ingreso recurrente"
      >
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
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
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Error");
            }
          }}
        >
          <Field label="Concepto">
            <Input
              required
              value={recName}
              onChange={(e) => setRecName(e.target.value)}
            />
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
              <Select
                value={recCur}
                onChange={(e) => setRecCur(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Frecuencia">
            <Select
              value={recFreq}
              onChange={(e) => setRecFreq(e.target.value)}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Próxima fecha">
            <Input
              type="date"
              value={recDate}
              onChange={(e) => setRecDate(e.target.value)}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
