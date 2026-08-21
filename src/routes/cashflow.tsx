import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Monitor, PageHeader, TableWrap } from "@/components/ui/monitor";
import { Pager, usePager } from "@/components/ui/pager";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import {
  activeIncomeKinds,
  categoryBreakdown,
  INCOME_KIND_META,
  monthlyProjectionStacked,
  monthlyTxSeries,
  projectCashflow,
  txTotals,
  type IncomeKind,
} from "@/lib/portfolio-math";
import {
  addTransaction,
  deleteRecurring,
  deleteTransaction,
  getPortfolio,
  importTransactionsCsv,
  upsertRecurring,
} from "@/lib/server/portfolio";
import { paymentCalendar } from "@/lib/analytics";
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
  const [recName, setRecName] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recCur, setRecCur] = useState("USD");
  const [recFreq, setRecFreq] = useState("MONTHLY");
  const [recDate, setRecDate] = useState(new Date().toISOString().slice(0, 10));
  const [recAssetId, setRecAssetId] = useState(data.assets[0]?.id ?? "");
  const [recAccountId, setRecAccountId] = useState("");
  const [recDirection, setRecDirection] = useState<"INCOME" | "EXPENSE">(
    "INCOME",
  );
  const [pending, setPending] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPending, setCsvPending] = useState(false);
  const [quickAmt, setQuickAmt] = useState("");
  const [quickDesc, setQuickDesc] = useState("");
  const [quickType, setQuickType] = useState("EXPENSE");

  const assetById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of data.assets)
      m.set(a.id, a.ticker ? `${a.ticker} · ${a.name}` : a.name);
    return m;
  }, [data.assets]);

  const accountById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of data.accounts) m.set(a.id, `${a.name} (${a.currency})`);
    return m;
  }, [data.accounts]);

  const stats = useMemo(() => {
    const totals = txTotals(data.transactions, data.fx.average);
    const projected = projectCashflow(
      data.recurring,
      data.transactions,
      data.fx.average,
      12,
    );
    const projStacked = monthlyProjectionStacked(projected, 12);
    const projKinds = activeIncomeKinds(projStacked);
    const series = monthlyTxSeries(data.transactions, data.fx.average, 6);
    const cats = categoryBreakdown(data.transactions, data.fx.average);
    const projectedTotal = projected.reduce((s, e) => s + e.amountUsd, 0);
    const calendar = paymentCalendar(projected, 12);
    return {
      totals,
      projected,
      projStacked,
      projKinds,
      series,
      cats,
      projectedTotal,
      calendar,
    };
  }, [data]);

  const recPager = usePager(data.recurring, 10);
  const txPager = usePager(data.transactions, 10);
  const eventPager = usePager(stats.projected, 10);

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="FLUJO"
        actions={
          <>
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
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi
          label="IN (listed)"
          value={formatUsd(stats.totals.income)}
          tone="gain"
        />
        <Kpi
          label="OUT (listed)"
          value={formatUsd(Math.abs(stats.totals.expense))}
          tone="loss"
        />
        <Kpi
          label="NET"
          value={formatUsd(stats.totals.net)}
          tone={stats.totals.net >= 0 ? "gain" : "loss"}
        />
        <Kpi
          label="PROJ 12M"
          value={formatUsd(stats.projectedTotal)}
          tone="accent"
        />
      </div>

      <form
        className="flex flex-wrap items-end gap-2 border border-border bg-surface p-2 md:hidden"
        onSubmit={async (e) => {
          e.preventDefault();
          const raw = Number(quickAmt) || 0;
          if (!quickDesc.trim() || !raw) return;
          const signed =
            quickType === "EXPENSE" ||
            quickType === "BUY" ||
            quickType === "TRANSFER"
              ? -Math.abs(raw)
              : Math.abs(raw);
          await addTransaction({
            data: {
              description: quickDesc.trim(),
              amount: signed,
              currency: "USD",
              type: quickType,
              category: quickType,
              date: new Date().toISOString().slice(0, 10),
            },
          });
          toast.success("OK");
          setQuickAmt("");
          setQuickDesc("");
          await router.invalidate();
        }}
      >
        <Input
          className="min-w-0 flex-1"
          placeholder="Concepto"
          value={quickDesc}
          onChange={(e) => setQuickDesc(e.target.value)}
        />
        <Input
          className="w-24"
          type="number"
          step="any"
          placeholder="Monto"
          value={quickAmt}
          onChange={(e) => setQuickAmt(e.target.value)}
        />
        <Select
          className="w-28"
          value={quickType}
          onChange={(e) => setQuickType(e.target.value)}
        >
          <option value="EXPENSE">Gasto</option>
          <option value="INCOME">Ingreso</option>
          <option value="COUPON">Cupón</option>
        </Select>
        <Button type="submit" size="sm">
          +
        </Button>
      </form>

      {stats.calendar ? (
        <Monitor title="PAYMENT CALENDAR · 12M">
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
            {stats.calendar.map((c) => (
              <div
                key={c.key}
                className={`border border-border p-1.5 text-center ${c.total > 0 ? "bg-raised" : "bg-surface"}`}
                title={`${c.count} pagos`}
              >
                <p className="font-mono text-[10px] text-subtle">{c.label}</p>
                <p
                  className={`font-mono text-[11px] tabular-nums ${c.total > 0 ? "text-gain" : "text-muted"}`}
                >
                  {c.total > 0 ? formatUsd(c.total) : "—"}
                </p>
                {c.count > 0 ? (
                  <p className="font-mono text-[9px] text-subtle">{c.count}x</p>
                ) : null}
              </div>
            ))}
          </div>
        </Monitor>
      ) : null}

      <Monitor title="IMPORT CSV">
        <p className="mb-2 font-mono text-[11px] text-muted">
          Formato: date,description,amount,currency,type (header opcional).
        </p>
        <textarea
          className="mb-2 h-20 w-full border border-border bg-bg p-2 font-mono text-[12px] text-fg"
          placeholder={"2026-09-01,Cupón AL30,1250,USD,COUPON"}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
        <Button
          type="button"
          disabled={csvPending || !csvText.trim()}
          onClick={async () => {
            const lines = csvText
              .trim()
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean);
            if (!lines.length) return;
            const start = /date/i.test(lines[0]) ? 1 : 0;
            const rows: {
              date: string;
              description: string;
              amount: number;
              currency: string;
              type: string;
              category: string | null;
            }[] = [];
            for (let i = start; i < lines.length; i++) {
              const parts = lines[i]
                .split(",")
                .map((x) => x.trim().replace(/^"|"$/g, ""));
              if (parts.length < 3) continue;
              const [
                d,
                description,
                amountStr,
                cur = "USD",
                txType = "INCOME",
              ] = parts;
              const amt = Number(amountStr);
              if (!d || !description || !Number.isFinite(amt)) continue;
              rows.push({
                date: d.slice(0, 10),
                description,
                amount: amt,
                currency: cur || "USD",
                type: txType || "INCOME",
                category: txType || null,
              });
            }
            if (!rows.length) {
              toast.error("No se parsearon filas");
              return;
            }
            setCsvPending(true);
            try {
              const r = await importTransactionsCsv({ data: { rows } });
              toast.success(`Importadas ${r.inserted} filas`);
              setCsvText("");
              await router.invalidate();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Error import");
            } finally {
              setCsvPending(false);
            }
          }}
        >
          {csvPending ? "Importando…" : "Importar CSV"}
        </Button>
      </Monitor>

      <Monitor title="RECURRING · MAPPED TO ASSETS">
        {data.assets.length === 0 ? (
          <p className="py-6 text-center font-mono text-xs text-muted">
            Primero cargá un activo en{" "}
            <Link to="/assets" className="text-accent underline">
              POS
            </Link>
            .
          </p>
        ) : data.recurring.length === 0 ? (
          <p className="py-6 text-center font-mono text-xs text-muted">
            Sin flujos recurrentes.
          </p>
        ) : (
          <>
            <TableWrap>
              <table className="w-full min-w-[520px] font-mono text-[12px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] tracking-widest text-accent">
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
                  {recPager.slice.map((r) => (
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
                        {r.accountId
                          ? accountById.get(r.accountId) || "—"
                          : "—"}
                      </td>
                      <td className="py-1.5 pr-2 text-muted">
                        {FREQUENCIES.find((f) => f.value === r.frequency)
                          ?.label || r.frequency}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-gain">
                        {formatUsd(
                          toUsd(r.amount, r.currency, data.fx.average),
                        )}
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
            </TableWrap>
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
      </Monitor>

      <div className="grid gap-2 lg:grid-cols-2">
        <Monitor title="MONTHLY IN / OUT (listed txs)">
          <div className="h-40">
            {stats.series.some((m) => m.in > 0 || m.out > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.series}
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="label"
                    tick={{
                      fill: "#6b7280",
                      fontSize: 10,
                      fontFamily: "IBM Plex Mono",
                    }}
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
              <p className="py-8 text-center font-mono text-xs text-muted">
                Sin serie todavía.
              </p>
            )}
          </div>
        </Monitor>
        <Monitor title="PROJECTED RECURRING 12M">
          <div className="flex h-44 flex-col">
            {stats.projStacked.some((m) => m.total > 0) ? (
              <>
                <div className="min-h-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.projStacked}
                      margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="label"
                        tick={{
                          fill: "#6b7280",
                          fontSize: 9,
                          fontFamily: "IBM Plex Mono",
                        }}
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
                        formatter={(v: number, name: string) => [
                          formatUsd(v),
                          INCOME_KIND_META[name as IncomeKind]?.label ?? name,
                        ]}
                      />
                      {stats.projKinds.map((k) => (
                        <Bar
                          key={k}
                          dataKey={k}
                          stackId="inc"
                          fill={INCOME_KIND_META[k].color}
                          fillOpacity={0.9}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-line pt-1">
                  {stats.projKinds.map((k) => (
                    <span
                      key={k}
                      className="flex items-center gap-1 font-mono text-[10px] text-muted"
                    >
                      <span
                        className="inline-block h-1.5 w-1.5"
                        style={{ background: INCOME_KIND_META[k].color }}
                      />
                      {INCOME_KIND_META[k].label}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-8 text-center font-mono text-xs text-muted">
                Mappeá ingresos recurrentes a tus activos.
              </p>
            )}
          </div>
        </Monitor>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Monitor title="SCHEDULE · NEXT EVENTS">
          <TableWrap>
            <table className="w-full min-w-[520px] font-mono text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] tracking-widest text-accent">
                  <th className="py-1">DATE</th>
                  <th className="py-1">NAME</th>
                  <th className="py-1">ASSET</th>
                  <th className="py-1 text-right">USD</th>
                </tr>
              </thead>
              <tbody>
                {eventPager.slice.map((e, i) => (
                  <tr
                    key={`${e.date}-${e.name}-${i}`}
                    className="border-b border-border/50"
                  >
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
                {eventPager.total === 0 ? (
                  <tr>
                    <td className="py-8 text-center text-subtle" colSpan={4}>
                      Sin eventos proyectados
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
          <Pager
            page={eventPager.page}
            totalPages={eventPager.totalPages}
            total={eventPager.total}
            from={eventPager.from}
            to={eventPager.to}
            onChange={eventPager.setPage}
          />
        </Monitor>
        <Monitor title="BY CATEGORY (listed)">
          <TableWrap>
            <table className="w-full min-w-[520px] font-mono text-[12px]">
              <tbody>
                {stats.cats.slice(0, 10).map((c) => (
                  <tr key={c.name} className="border-b border-border/50">
                    <td className="py-1">{c.name}</td>
                    <td
                      className={`py-1 text-right tabular-nums ${c.value >= 0 ? "text-gain" : "text-loss"}`}
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
          </TableWrap>
        </Monitor>
      </div>

      <Monitor title="LEDGER">
        <ul className="divide-y divide-border font-mono text-xs">
          {txPager.slice.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 px-1 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-fg">{t.description}</p>
                <p className="text-[11px] text-subtle">
                  {t.date} · {t.category || t.type}
                  {t.assetId && assetById.get(t.assetId)
                    ? ` · ${assetById.get(t.assetId)}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p
                  className={`tabular-nums ${t.amount >= 0 ? "text-gain" : "text-loss"}`}
                >
                  {t.amount >= 0 ? "+" : ""}
                  {formatUsd(
                    Math.abs(toUsd(t.amount, t.currency, data.fx.average)),
                  )}
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
            <li className="py-12 text-center text-sm text-muted">
              Sin movimientos.
            </li>
          ) : null}
        </ul>
        <Pager
          page={txPager.page}
          totalPages={txPager.totalPages}
          total={txPager.total}
          from={txPager.from}
          to={txPager.to}
          onChange={txPager.setPage}
        />
      </Monitor>

      <Dialog
        open={recOpen}
        onOpenChange={setRecOpen}
        title="Mapear flujo recurrente"
      >
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
                  direction: recDirection,
                },
              });
              toast.success("Flujo mapeado al activo");
              setRecOpen(false);
              setRecName("");
              setRecAmount("");
              setRecAccountId("");
              await router.invalidate();
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "No se pudo guardar",
              );
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
            <Select
              value={recAccountId}
              onChange={(e) => setRecAccountId(e.target.value)}
            >
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
          <Field label="Dirección">
            <Select
              value={recDirection}
              onChange={(e) =>
                setRecDirection(e.target.value as "INCOME" | "EXPENSE")
              }
            >
              <option value="INCOME">Ingreso</option>
              <option value="EXPENSE">Gasto</option>
            </Select>
          </Field>
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
            <Input
              required
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
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
              <Select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
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
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
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
    tone === "gain"
      ? "text-gain"
      : tone === "loss"
        ? "text-loss"
        : "text-accent";
  return (
    <div className="border border-border bg-surface p-2">
      <p className="font-mono text-[11px] tracking-widest text-accent">
        {label}
      </p>
      <p className={`font-mono text-sm tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
