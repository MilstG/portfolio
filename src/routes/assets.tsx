import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AssetForm } from "@/components/asset-form";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Pager, usePager } from "@/components/ui/pager";
import { Button } from "@/components/ui/button";
import { deleteAsset, getPortfolio, upsertAsset } from "@/lib/server/portfolio";
import { ASSET_TYPES, formatUsd } from "@/lib/utils";

export const Route = createFileRoute("/assets")({
  loader: () => getPortfolio(),
  component: AssetsPage,
});

function AssetsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  const list = useMemo(() => {
    const rows = data.assets;
    if (filter === "ALL") return rows;
    return rows.filter((a) => a.type === filter);
  }, [data.assets, filter]);

  const pager = usePager(list, 10);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-sm tracking-widest text-accent">POS</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-3.5" /> ADD
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {[{ value: "ALL", label: "ALL" }, ...ASSET_TYPES].map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`border px-2 py-0.5 font-mono text-[10px] tracking-widest ${
              filter === f.value
                ? "border-accent text-accent"
                : "border-border text-muted hover:text-fg"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="border border-border bg-surface">
        <table className="w-full font-mono text-[11px]">
          <thead>
            <tr className="border-b border-border text-left text-[10px] tracking-widest text-accent">
              <th className="px-2 py-1">NAME</th>
              <th className="px-2 py-1">TYPE</th>
              <th className="px-2 py-1 text-right">VALUE</th>
              <th className="px-2 py-1 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {pager.slice.map((a) => {
              const typeLabel = ASSET_TYPES.find((t) => t.value === a.type)?.label ?? a.type;
              return (
                <tr key={a.id} className="border-b border-border/50 hover:bg-raised/40">
                  <td className="px-2 py-1.5">
                    <Link to="/assets/$id" params={{ id: a.id }} className="text-fg hover:text-accent">
                      {a.name}
                      {a.ticker ? <span className="ml-1 text-subtle">{a.ticker}</span> : null}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-muted">{typeLabel}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatUsd(a.currentValue)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar"
                      onClick={() => setDelId(a.id)}
                    >
                      <Trash2 className="size-4 text-loss" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-10 text-center text-muted">
                  Sin activos
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="px-2 pb-1">
          <Pager
            page={pager.page}
            totalPages={pager.totalPages}
            total={pager.total}
            from={pager.from}
            to={pager.to}
            onChange={pager.setPage}
          />
        </div>
      </div>

      {open ? (
        <AssetForm
          open
          pending={pending}
          onClose={() => setOpen(false)}
          onSubmit={async (payload) => {
            setPending(true);
            try {
              await upsertAsset({ data: payload });
              toast.success("Activo guardado");
              setOpen(false);
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
        open={!!delId}
        title="Eliminar activo"
        body="Se borra el activo y sus ingresos recurrentes."
        pending={pending}
        onClose={() => setDelId(null)}
        onConfirm={async () => {
          if (!delId) return;
          setPending(true);
          try {
            await deleteAsset({ data: { id: delId } });
            toast.success("Eliminado");
            setDelId(null);
            await router.invalidate();
          } finally {
            setPending(false);
          }
        }}
      />
    </div>
  );
}
