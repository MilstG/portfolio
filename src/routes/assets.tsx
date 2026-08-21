import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AssetForm } from "@/components/asset-form";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Pager, usePager } from "@/components/pager";
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
  const pager = usePager(list, 10);

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
              filter === f.value
                ? "border-accent bg-accent text-accent-fg"
                : "bg-surface text-muted hover:text-fg",
            )}
          >
            {f.label.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="overflow-hidden border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left font-mono text-xs">
            <thead className="border-b border-border text-[10px] tracking-widest text-muted">
              <tr>
                <th className="px-2 py-1.5">NAME</th>
                <th className="px-2 py-1.5">TYPE</th>
                <th className="px-2 py-1.5 text-right">QTY</th>
                <th className="px-2 py-1.5 text-right">VALUE</th>
                <th className="px-2 py-1.5 text-right">COST</th>
                <th className="px-2 py-1.5 text-right">P&L%</th>
                <th className="px-2 py-1.5 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {pager.slice.map((a) => {
                const val = toUsd(a.currentValue, a.currency, data.fx.average);
                const cost = toUsd(a.costBasis, a.currency, data.fx.average);
                const pnl = cost ? ((val - cost) / cost) * 100 : 0;
                return (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-black/30">
                    <td className="px-2 py-1.5">
                      <span className="text-fg">{a.name}</span>
                      {a.ticker ? (
                        <span className="ml-1 text-subtle">{a.ticker}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 text-muted">{a.type}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-subtle">
                      {a.quantity}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatUsd(a.currentValue)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                      {formatUsd(a.costBasis)}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums ${
                        pnl >= 0 ? "text-gain" : "text-loss"
                      }`}
                    >
                      {formatPct(pnl)}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar"
                          onClick={() => setEditing(a)}
                        >
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
        ) : (
          <div className="px-2 pb-2">
            <Pager
              page={pager.page}
              totalPages={pager.totalPages}
              total={pager.total}
              from={pager.from}
              to={pager.to}
              onChange={pager.setPage}
            />
          </div>
        )}
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
        body={
          deleting
            ? `Se va a borrar “${deleting.name}” de la base de datos. No vuelve al cambiar de pantalla.`
            : ""
        }
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
