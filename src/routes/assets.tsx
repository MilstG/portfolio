import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AssetForm } from "@/components/asset-form";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Monitor, PageHeader, TableWrap } from "@/components/ui/monitor";
import { Pager, usePager } from "@/components/ui/pager";
import { Button } from "@/components/ui/button";
import { deleteAsset, getPortfolio, upsertAsset } from "@/lib/server/portfolio";
import type { Asset } from "@/lib/types";
import { ASSET_TYPES, formatPct, formatUsd, toUsd } from "@/lib/utils";

export const Route = createFileRoute("/assets")({
  loader: () => getPortfolio(),
  component: AssetsPage,
});

function AssetsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState<Asset | null | "new">(null);
  const [pending, setPending] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  const list = useMemo(() => {
    const rows = data.assets;
    if (filter === "ALL") return rows;
    return rows.filter((a) => a.type === filter);
  }, [data.assets, filter]);

  const pager = usePager(list, 10);
  const fx = data.fx.average;
  const totalUsd = list.reduce(
    (s, a) => s + toUsd(a.currentValue, a.currency, fx),
    0,
  );

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="POS"
        meta={
          <>
            <p className="font-mono text-xs tabular-nums text-fg">
              {formatUsd(totalUsd)}
            </p>
            <p className="font-mono text-[11px] text-muted">
              {list.length} POSICIONES
            </p>
          </>
        }
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-3.5" /> ADD
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1">
        {[{ value: "ALL", label: "ALL" }, ...ASSET_TYPES].map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`border px-2 py-1 font-mono text-[11px] tracking-widest ${
              filter === f.value
                ? "border-accent text-accent"
                : "border-border text-muted hover:text-fg"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Monitor title="POSITIONS" bodyClassName="p-0">
        <TableWrap className="mx-0 px-0">
          <table className="w-full min-w-[640px] font-mono text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-widest text-accent">
                <th className="px-2 py-1.5">NAME</th>
                <th className="px-2 py-1.5">TYPE</th>
                <th className="px-2 py-1.5 text-right">QTY</th>
                <th className="px-2 py-1.5 text-right">COST</th>
                <th className="px-2 py-1.5 text-right">VALUE</th>
                <th className="px-2 py-1.5 text-right">P&L</th>
                <th className="px-2 py-1.5 text-right">WGT</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {pager.slice.map((a) => {
                const typeLabel =
                  ASSET_TYPES.find((t) => t.value === a.type)?.label ?? a.type;
                const valueUsd = toUsd(a.currentValue, a.currency, fx);
                const costUsd = toUsd(a.costBasis, a.currency, fx);
                const pnl = valueUsd - costUsd;
                const pnlPct = costUsd > 0 ? (pnl / costUsd) * 100 : 0;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-border/50 hover:bg-raised/40"
                  >
                    <td className="px-2 py-1.5">
                      <Link
                        to="/assets/$id"
                        params={{ id: a.id }}
                        className="text-fg hover:text-accent"
                      >
                        {a.name}
                        {a.ticker ? (
                          <span className="ml-1 text-subtle">{a.ticker}</span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 text-muted">{typeLabel}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                      {a.quantity != null && a.quantity !== 1
                        ? a.quantity
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                      {formatUsd(costUsd)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatUsd(valueUsd)}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums ${pnl >= 0 ? "text-gain" : "text-loss"}`}
                    >
                      {formatUsd(pnl)}{" "}
                      <span className="text-[11px] opacity-80">
                        {formatPct(pnlPct)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-subtle">
                      {totalUsd > 0
                        ? ((valueUsd / totalUsd) * 100).toFixed(1)
                        : 0}
                      %
                    </td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Editar"
                        onClick={() => setEditing(a)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Eliminar"
                        onClick={() => setDelId(a.id)}
                      >
                        <Trash2 className="size-3.5 text-loss" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-10 text-center text-muted">
                    Sin activos
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
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
      </Monitor>

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
