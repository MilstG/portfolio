import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import {
  categoryBreakdown,
  monthlyProjectionBuckets,
  monthlyTxSeries,
  projectRecurring,
  txTotals,
} from "@/lib/portfolio-math";
import {
  addTransaction,
  deleteRecurring,
  deleteTransaction,
  getPortfolio,
  upsertRecurring,
} from "@/lib/server/portfolio";
import {
  CURRENCIES,
  FREQUENCIES,
  TX_TYPES,
  formatUsd,
  toUsd,
} from "@/lib/utils";

export const Route = createFileRoute("/cashflow")({
  loader: () => getPortfolio(),
  component: CashflowPage,
});

function CashflowPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recOpen, setRecOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("EXPENSE");
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("");

  // Recurring form — mapped to existing asset (+ optional cash account)
  const [recName, setRecName] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recCur, setRecCur] = useState("USD");
  const [recFreq, setRecFreq] = useState("MONTHLY");
  const [recDate, setRecDate] = useState(new Date().toISOString().slice(0, 10));
  const [recAssetId, setRecAssetId] = useState(data.assets[0]?.id ?? "");
  const [recAccountId, setRecAccountId] = useState("");
  const [pending, setPending] = useState(false);

  const assetById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of data.assets) m.set(a.id, a.ticker ? `${a.ticker} · ${a.name}` : a.name);
    return m;
  }, [data.assets]);

  const accountById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of data.accounts) m.set(a.id, `${a.name} (${a.currency})`);
    return m;
  }, [data.accounts]);

  const stats = useMemo(() => {
    const totals = txTotals(data.transactions, data.fx.average);
    const projected = projectRecurring(data.recurring, data.fx.average, 12);
    const projMonths = monthlyProjectionBuckets(projected, 12);
    const series = monthlyTxSeries(data.transactions, data.fx.average, 6);
    const cats = categoryBreakdown(data.transactions, data.fx.average);
    const nextEvents = projected.slice(0, 10);
    const projectedTotal = projected.reduce((s, e) => s + e.amountUsd, 0);
    return { totals, projected, projMonths, series, cats, nextEvents, projectedTotal };
  }, [data]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-sm tracking-widest text-accent">FLUJO</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setRecAssetId(data.assets[0]?.id ?? "");
              setRecOpen(true);
            }}
            disabled={data.assets.length === 0}
          >
            <Plus className="size-3.5" /> RECURRING
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-3.5" /> TX
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="IN (listed)" value={formatUsd(stats.totals.income)} tone="gain" />
        <Kpi label="OUT (listed)" value={formatUsd(Math.abs(stats.totals.expense))} tone="loss" />
        <Kpi
          label="NET"
          value={formatUsd(stats.totals.net)}
          tone={stats.totals.net >= 0 ? "gain" : "loss"}
        />
        <Kpi label="PROJ 12M" value={formatUsd(stats.projectedTotal)} tone="accent" />
      </div>

      <Panel title="RECURRING · MAPPED TO ASSETS">
        {data.assets.length === 0 ? (
          <p className="py-6 text-center font-mono text-xs text-muted">
            Primero cargá un activo en{" "}
            <Link to="/assets" className="text-accent underline">
              POS
            </Link>{" "}
            y después mappeá el flujo acá.
          </p>
        ) : data.recurring.length === 0 ? (
          <p className="py-6 text-center font-mono text-xs text-muted">
            Sin flujos recurrentes. Usá RECURRING para mappear alquiler/cupón a un activo existente.
          </p>
        ) : (
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] tracking-widest text-accent">
                <th className="py-1 pr-2">NAME</th>
                <th className="py-1 pr-2">ASSET</th>
                <th className="py-1 pr-2">TO CASH</th>
                <th className="py-1 pr-2">FREQ</th>
                <th className="py-1 pr-2 text-right">AMT</th>
                <th className="py-1 pr-2">NEXT</th>
                <th className="py-1 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {data.recurring.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="truncate py-1.5 pr-2 text-fg">{r.name}</td>
                  <td className="truncate py-1.5 pr-2">
                    <Link
                      to="/assets/$id"
                      params={{ id: r.assetId }}
                      className="text-accent hover:underline"
                    >
                      {assetById.get(r.assetId) || r.assetId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="truncate py-1.5 pr-2 text-muted">
                    {r.accountId ? accountById.get(r.accountId) || "—" : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-muted">
                    {FREQUENCIES.find((f) => f.value === r.frequency)?.label || r.frequency}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-gain">
                    {formatUsd(toUsd(r.amount, r.currency, data.fx.average))}
                  </td>
                  <td className="py-1.5 pr-2 text-muted">{r.nextDate}</td>
                  <td className="py-1.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar recurrente"
                      onClick={async () => {
                        await deleteRecurring({ data: { id: r.id } });
                        toast.success("Recurrente eliminado");
                        await router.invalidate();
                      }}
                    >
                      <Trash2 className="size-4 text-loss" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="grid gap-2 lg:grid-cols-2">
        <Panel title="MONTHLY IN / OUT (listed txs)">
          <div className="h-40">
            {stats.series.some((m) => m.in > 0 || m.out > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: "#000",
                      border: "1px solid #ff6d00",
                      borderRadius: 0,
                      fontSize: 11,
                      fontFamily: "IBM Plex Mono",
                    }}
                    formatter={(v: number, name: string) => [
                      formatUsd(v),
                      name === "in" ? "IN" : "OUT",
                    ]}
                  />
                  <Bar dataKey="in" fill="#00e676" fillOpacity={0.85} />
                  <Bar dataKey="out" fill="#ff5252" fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center font-mono text-xs text-muted">Sin serie todavía.</p>
            )}
          </div>
        </Panel>
        <Panel title="PROJECTED RECURRING 12M">
          <div className="h-40">
            {stats.projMonths.some((m) => m.total > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.projMonths} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#6b7280", fontSize: 9, fontFamily: "IBM Plex Mono" }}
                    axisLine={false}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: "#000",
                      border: "1px solid #ff6d00",
                      borderRadius: 0,
                      fontSize: 11,
                      fontFamily: "IBM Plex Mono",
                    }}
                    formatter={(v: number) => [formatUsd(v), "PROJ"]}
                  />
                  <Bar dataKey="total" fill="#ff6d00" fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center font-mono text-xs text-muted">
                Mappeá ingresos recurrentes a tus activos.
              </p>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Panel title="SCHEDULE · NEXT EVENTS">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] tracking-widest text-accent">
                <th className="py-1">DATE</th>
                <th className="py-1">NAME</th>
                <th className="py-1">ASSET</th>
                <th className="py-1 text-right">USD</th>
              </tr>
            </thead>
            <tbody>
              {stats.nextEvents.map((e, i) => (
                <tr key={`${e.date}-${e.name}-${i}`} className="border-b border-border/50">
                  <td className="py-1 text-muted">{e.date}</td>
                  <td className="truncate py-1">{e.name}</td>
                  <td className="truncate py-1 text-subtle">
                    {assetById.get(e.assetId) || "—"}
                  </td>
                  <td className="py-1 text-right tabular-nums text-gain">
                    {formatUsd(e.amountUsd)}
                  </td>
                </tr>
              ))}
              {stats.nextEvents.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-subtle" colSpan={4}>
                    Sin eventos proyectados
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Panel>
        <Panel title="BY CATEGORY (listed)">
          <table className="w-full font-mono text-[11px]">
            <tbody>
              {stats.cats.slice(0, 10).map((c) => (
                <tr key={c.name} className="border-b border-border/50">
                  <td className="py-1">{c.name}</td>
                  <td
                    className={`py-1 text-right tabular-nums ${
                      c.value >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {formatUsd(c.value)}
                  </td>
                </tr>
              ))}
              {stats.cats.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-subtle" colSpan={2}>
                    Sin categorías
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="LEDGER">
        <ul className="divide-y divide-border font-mono text-xs">
          {data.transactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-1 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-fg">{t.description}</p>
                <p className="text-[10px] text-subtle">
                  {t.date} · {t.category || t.type}
                  {t.assetId && assetById.get(t.assetId)
                    ? ` · ${assetById.get(t.assetId)}`
                    : ""}
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
            <li className="py-12 text-center text-sm text-muted">Sin movimientos.</li>
          ) : null}
        </ul>
      </Panel>

      <Dialog open={recOpen} onOpenChange={setRecOpen} title="Mapear flujo recurrente">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!recAssetId) {
              toast.error("Elegí un activo");
              return;
            }
            setPending(true);
            try {
              await upsertRecurring({
                data: {
                  assetId: recAssetId,
                  accountId: recAccountId || null,
                  name: recName,
                  amount: Number(recAmount) || 0,
                  currency: recCur,
                  frequency: recFreq,
                  nextDate: recDate || new Date().toISOString().slice(0, 10),
                },
              });
              toast.success("Flujo mapeado al activo");
              setRecOpen(false);
              setRecName("");
              setRecAmount("");
              setRecAccountId("");
              await router.invalidate();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "No se pudo guardar");
            } finally {
              setPending(false);
            }
          }}
        >
          <Field label="Activo (obligatorio)">
            <Select
              required
              value={recAssetId}
              onChange={(e) => setRecAssetId(e.target.value)}
            >
              <option value="" disabled>
                Elegí un activo cargado…
              </option>
              {data.assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.ticker ? `${a.ticker} · ` : "") + a.name} ({a.type})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cuenta cash destino (opcional)">
            <Select value={recAccountId} onChange={(e) => setRecAccountId(e.target.value)}>
              <option value="">Sin acreditar cuenta</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Concepto">
            <Input
              required
              value={recName}
              onChange={(e) => setRecName(e.target.value)}
              placeholder="Alquiler, cupón, dividendo…"
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
          <p className="font-mono text-[10px] text-subtle">
            Al vencer, se genera la tx ligada al activo. Si elegís cuenta cash, se acredita el saldo.
          </p>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Mapear"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen} title="Nuevo movimiento">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const raw = Number(amount) || 0;
            const signed =
              type === "EXPENSE" || type === "BUY" || type === "TRANSFER"
                ? -Math.abs(raw)
                : Math.abs(raw);
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
              <Input
                required
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
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
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Housing, Food…"
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

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "gain" | "loss" | "accent";
}) {
  const color =
    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-accent";
  return (
    <div className="border border-border bg-surface p-2">
      <p className="font-mono text-[10px] tracking-widest text-accent">{label}</p>
      <p className={`font-mono text-sm tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-border bg-surface">
      <header className="border-b border-border bg-raised px-2 py-1">
        <h2 className="font-mono text-[10px] tracking-widest text-accent">{title}</h2>
      </header>
      <div className="p-2">{children}</div>
    </section>
  );
}
