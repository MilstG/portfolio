import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AccountForm } from "@/components/account-form";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Monitor, PageHeader, TableWrap } from "@/components/ui/monitor";
import { Pager, usePager } from "@/components/ui/pager";
import {
  deleteAccount,
  getPortfolio,
  upsertAccount,
} from "@/lib/server/portfolio";
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
  const fx = data.fx.average;
  const total = data.accounts.reduce(
    (s, a) => s + toUsd(a.balance, a.currency, fx),
    0,
  );
  const pager = usePager(data.accounts, 25);

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="CASH"
        meta={
          <>
            <p className="font-mono text-xs tabular-nums text-fg">
              {formatUsd(total)}
            </p>
            <p className="font-mono text-[11px] text-muted">
              {data.accounts.length} ACCTS · FX {fx.toFixed(0)}
            </p>
          </>
        }
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-3.5" /> ADD
          </Button>
        }
      />

      <Monitor title="ACCOUNTS" bodyClassName="p-0">
        <TableWrap className="mx-0 px-0">
          <table className="w-full min-w-[560px] font-mono text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-widest text-accent">
                <th className="px-2 py-1.5">NAME</th>
                <th className="px-2 py-1.5">TYPE</th>
                <th className="px-2 py-1.5">CCY</th>
                <th className="px-2 py-1.5 text-right">BALANCE</th>
                <th className="px-2 py-1.5 text-right">USD</th>
                <th className="px-2 py-1.5 text-right">%</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {pager.slice.map((a) => {
                const usd = toUsd(a.balance, a.currency, fx);
                const type =
                  ACCOUNT_TYPES.find((t) => t.value === a.type)?.label ??
                  a.type;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-border/50 hover:bg-raised/40"
                  >
                    <td className="px-2 py-1.5">
                      <span className="text-fg">{a.name}</span>
                      {a.institution ? (
                        <span className="ml-1.5 text-subtle">
                          {a.institution}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 text-muted">{type}</td>
                    <td className="px-2 py-1.5 text-muted">{a.currency}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatAmount(a.balance, a.currency)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-fg">
                      {formatUsd(usd)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-subtle">
                      {total > 0 ? ((usd / total) * 100).toFixed(0) : 0}%
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
                        onClick={() => setDeleting(a)}
                      >
                        <Trash2 className="size-3.5 text-loss" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {data.accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-10 text-center text-muted">
                    No hay cuentas. Agregá una con ADD.
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
              toast.success(
                editing === "new" ? "Cuenta creada" : "Cuenta actualizada",
              );
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
        body={deleting ? `¿Borrar ${deleting.name}?` : ""}
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
