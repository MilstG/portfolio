import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AssetForm } from "@/components/asset-form";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { deleteAsset, getPortfolio, upsertAsset } from "@/lib/server/portfolio";
import type { Asset } from "@/lib/types";
import { ASSET_TYPES, cn, formatPct, formatUsd, toUsd } from "@/lib/utils";

export const Route = createFileRoute("/assets")({
  loader: () => getPortfolio(),
  component: AssetsPage,
});

export default function AssetsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");
  const [editing, setEditing] = useState<Asset | null | "new">(null);
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const [pending, setPending] = useState(false);

  const list =
    filter === "ALL" ? data.assets : data.assets.filter((a) => a.type === filter);
  const total = list.reduce((s, a) => s + toUsd(a.currentValue, a.currency, data.fx.average), 0);

  async function refresh() {
    await router.invalidate();
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-sm tracking-widest text-accent">POS</h1>
          <p className="font-mono text-xs text-muted">
            {list.length} · {formatUsd(total)}
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-3.5" /> ADD
        </Button>
      </div>

      <div className="mb-2 flex flex-wrap">
        {[{ value: "ALL", label: "ALL" }, ...ASSET_TYPES].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "h-7 border border-border px-2 font-mono text-[10px] tracking-wide",
              filter === f.value ? "border-accent bg-accent text-accent-fg" : "bg-surface text-muted hover:text-fg",
            )}
          >
            {f.label.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="overflow-hidden border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left font-mono text-xs">
            <thead className="border-b border-border bg-raised text-[10px] tracking-widest text-accent">
              <tr>
                <th className="px-2 py-1.5 font-medium">TICKER</th>
                <th className="px-2 py-1.5 font-medium">TYPE</th>
                <th className="px-2 py-1.5 text-right font-medium">LAST</th>
                <th className="px-2 py-1.5 text-right font-medium">COST</th>
                <th className="px-2 py-1.5 text-right font-medium">PNL</th>
                <th className="px-2 py-1.5 text-right font-medium"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((a) => {
                const pnl = a.costBasis ? ((a.currentValue - a.costBasis) / a.costBasis) * 100 : 0;
                const label = ASSET_TYPES.find((t) => t.value === a.type)?.label ?? a.type;
                return (
                  <tr key={a.id} className="hover:bg-raised">
                    <td className="px-2 py-1.5">
                      <p className="text-fg">{a.name}</p>
                      {a.ticker ? <p className="text-[10px] text-accent">{a.ticker}</p> : null}
                    </td>
                    <td className="px-2 py-1.5 text-muted">{label.toUpperCase()}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatUsd(a.currentValue)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted">{formatUsd(a.costBasis)}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${pnl >= 0 ? "text-gain" : "text-loss"}`}>
                      {formatPct(pnl)}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setEditing(a)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button asChild variant="ghost" size="icon-sm">
                          <Link to="/assets/$id" params={{ id: a.id }} aria-label="Ver">
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Eliminar"
                          onClick={() => setDeleting(a)}
                        >
                          <Trash2 className="size-4 text-loss" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            No hay activos. Agregá el primero — queda guardado en la base.
          </p>
        ) : null}
      </div>

      {editing !== null ? (
        <AssetForm
          key={editing === "new" ? "new" : editing.id}
          open
          initial={editing === "new" ? null : editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            setPending(true);
            try {
              await upsertAsset({ data: payload });
              toast.success("Activo guardado");
              setEditing(null);
              await refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "No se pudo guardar");
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}

      <ConfirmDelete
        open={!!deleting}
        title="Eliminar activo"
        body={deleting ? `Se va a borrar “${deleting.name}” de la base de datos. No vuelve al cambiar de pantalla.` : ""}
        pending={pending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          setPending(true);
          try {
            await deleteAsset({ data: { id: deleting.id } });
            toast.success("Eliminado");
            setDeleting(null);
            await refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
          } finally {
            setPending(false);
          }
        }}
      />
    </div>
  );
}
