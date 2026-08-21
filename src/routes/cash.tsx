import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AccountForm } from "@/components/account-form";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Pager, usePager } from "@/components/pager";
import { Button } from "@/components/ui/button";
import { deleteAccount, getPortfolio, upsertAccount } from "@/lib/server/portfolio";
import type { Account } from "@/lib/types";
import { ACCOUNT_TYPES, formatAmount, formatUsd, toUsd } from "@/lib/utils";

export const Route = createFileRoute("/cash")({
  loader: () => getPortfolio(),
  component: CashPage,
});

function CashPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState<Account | null | "new">(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [pending, setPending] = useState(false);
  const total = data.accounts.reduce((s, a) => s + toUsd(a.balance, a.currency, data.fx.average), 0);
  const pager = usePager(data.accounts, 10);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-sm tracking-widest text-accent">CASH</h1>
          <p className="font-mono text-xs tabular-nums text-fg">{formatUsd(total)}</p>
          <p className="font-mono text-[10px] text-muted">
            {data.accounts.length} ACCTS · FX {data.fx.average.toFixed(0)}
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-3.5" /> ADD
        </Button>
      </div>

      <ul className="mt-8 space-y-3">
        {pager.slice.map((a) => {
          const usd = toUsd(a.balance, a.currency, data.fx.average);
          const type = ACCOUNT_TYPES.find((t) => t.value === a.type)?.label ?? a.type;
          return (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 border border-border bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{a.name}</p>
                <p className="text-xs text-subtle">
                  {type}
                  {a.institution ? ` · ${a.institution}` : ""} · {a.currency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="tabular-nums text-fg">{formatAmount(a.balance, a.currency)}</p>
                  {a.currency !== "USD" && a.currency !== "USDT" ? (
                    <p className="text-xs text-subtle">≈ {formatUsd(usd)}</p>
                  ) : null}
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setEditing(a)}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Eliminar" onClick={() => setDeleting(a)}>
                  <Trash2 className="size-4 text-loss" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {data.accounts.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted">No hay cuentas. Agregá una y queda en la base.</p>
      ) : (
        <Pager
          page={pager.page}
          totalPages={pager.totalPages}
          total={pager.total}
          from={pager.from}
          to={pager.to}
          onChange={pager.setPage}
          className="mt-2"
        />
      )}

      {editing !== null ? (
        <AccountForm
          key={editing === "new" ? "new" : editing.id}
          open
          initial={editing === "new" ? null : editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            setPending(true);
            try {
              await upsertAccount({
                data: {
                  id: editing === "new" ? undefined : editing.id,
                  ...values,
                },
              });
              toast.success(editing === "new" ? "Cuenta creada" : "Cuenta actualizada");
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
        open={!!deleting}
        title="Eliminar cuenta"
        description={deleting ? `¿Borrar ${deleting.name}?` : ""}
        pending={pending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          setPending(true);
          try {
            await deleteAccount({ data: { id: deleting.id } });
            toast.success("Eliminado");
            setDeleting(null);
            await router.invalidate();
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
