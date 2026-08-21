import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Monitor, PageHeader } from "@/components/ui/monitor";
import { setPin } from "@/lib/server/auth";
import {
  deleteGoal,
  deleteLiability,
  deleteWatchItem,
  getPortfolio,
  refreshWatchlistPrices,
  setAllocTargets,
  updateFx,
  upsertGoal,
  upsertLiability,
  upsertWatchItem,
} from "@/lib/server/portfolio";
import { backfillSnapshots } from "@/lib/server/extra-actions";
import { formatUsd, toUsd } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  loader: () => getPortfolio(),
  component: SettingsPage,
});

const ASSET_TYPES = [
  "CRYPTO",
  "STOCK",
  "BOND",
  "REAL_ESTATE",
  "CASH",
  "OTHER",
] as const;

function SettingsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [official, setOfficial] = useState(String(data.fx.official));
  const [blue, setBlue] = useState(String(data.fx.blue));
  const [mep, setMep] = useState(String(data.fx.mep));
  const [pending, setPending] = useState(false);
  const [snapshotCsv, setSnapshotCsv] = useState("");
  const [snapBusy, setSnapBusy] = useState(false);
  const avg =
    ((Number(official) || 0) + (Number(blue) || 0) + (Number(mep) || 0)) / 3;

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinPending, setPinPending] = useState(false);
  const pinOn = Boolean(data.settings?.pinEnabled && data.settings?.hasPin);

  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalNotes, setGoalNotes] = useState("");
  const [goalPending, setGoalPending] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  const [allocDraft, setAllocDraft] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const t of ASSET_TYPES) {
      const found = data.allocTargets.find((a) => a.assetType === t);
      m[t] = found ? String(found.targetPct) : "0";
    }
    return m;
  });
  const [allocPending, setAllocPending] = useState(false);
  const allocSum = ASSET_TYPES.reduce(
    (s, t) => s + (Number(allocDraft[t]) || 0),
    0,
  );

  const [liabName, setLiabName] = useState("");
  const [liabBal, setLiabBal] = useState("");
  const [liabCur, setLiabCur] = useState("USD");
  const [liabRate, setLiabRate] = useState("");
  const [liabPending, setLiabPending] = useState(false);

  const [wTicker, setWTicker] = useState("");
  const [wName, setWName] = useState("");
  const [wType, setWType] = useState("STOCK");
  const [wPending, setWPending] = useState(false);

  const debtUsd = (data.liabilities || []).reduce(
    (s, l) => s + toUsd(l.balance, l.currency, data.fx.average),
    0,
  );
  const fxHistAsc = [...(data.fxHistory || [])].reverse();

  function resetGoalForm() {
    setGoalName("");
    setGoalTarget("");
    setGoalDate("");
    setGoalNotes("");
    setEditingGoalId(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="CFG"
        meta={
          <p className="font-mono text-[11px] text-muted">
            GOALS · DEUDAS · ALLOC · PASSWORD · FX · WATCHLIST · EXPORT
          </p>
        }
      />
      <div className="grid items-start gap-2 md:grid-cols-2">
        <Monitor title="GOALS">
          <p className="mb-3 font-mono text-[12px] text-muted">
            Objetivos de patrimonio en USD.
          </p>
          {data.goals.length > 0 ? (
            <ul className="mb-3 space-y-1.5 border-b border-line pb-3">
              {data.goals.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-2 font-mono text-[12px]"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-fg">{g.name}</span>
                    <span className="ml-2 tabular-nums text-accent">
                      {formatUsd(g.targetUsd)}
                    </span>
                    {g.targetDate ? (
                      <span className="ml-2 text-subtle">{g.targetDate}</span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar"
                      onClick={() => {
                        setEditingGoalId(g.id);
                        setGoalName(g.name);
                        setGoalTarget(String(g.targetUsd));
                        setGoalDate(g.targetDate || "");
                        setGoalNotes(g.notes || "");
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar"
                      onClick={async () => {
                        try {
                          await deleteGoal({ data: { id: g.id } });
                          toast.success("Goal eliminado");
                          if (editingGoalId === g.id) resetGoalForm();
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
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 font-mono text-[12px] text-subtle">
              Sin goals todavía.
            </p>
          )}
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const target = Number(goalTarget);
              if (!goalName.trim()) {
                toast.error("Nombre requerido");
                return;
              }
              if (!target || target <= 0) {
                toast.error("Target USD debe ser > 0");
                return;
              }
              setGoalPending(true);
              try {
                await upsertGoal({
                  data: {
                    id: editingGoalId || undefined,
                    name: goalName.trim(),
                    targetUsd: target,
                    targetDate: goalDate || null,
                    notes: goalNotes || null,
                  },
                });
                toast.success(
                  editingGoalId ? "Goal actualizado" : "Goal creado",
                );
                resetGoalForm();
                await router.invalidate();
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "No se pudo guardar",
                );
              } finally {
                setGoalPending(false);
              }
            }}
          >
            <Field label={editingGoalId ? "Editar goal" : "Nuevo goal"}>
              <Input
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="Ej: FIRE 1M"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Target USD">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                />
              </Field>
              <Field label="Fecha target (opc)">
                <Input
                  type="date"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Notas (opc)">
              <Input
                value={goalNotes}
                onChange={(e) => setGoalNotes(e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={goalPending}>
                {goalPending ? "…" : editingGoalId ? "Guardar" : "Agregar goal"}
              </Button>
              {editingGoalId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetGoalForm}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
        </Monitor>

        <Monitor title="DEUDAS / LIABILITIES">
          <p className="mb-3 font-mono text-[12px] text-muted">
            Se restan del net worth. Total:{" "}
            <span className="tabular-nums text-loss">{formatUsd(debtUsd)}</span>
          </p>
          {(data.liabilities || []).length > 0 ? (
            <ul className="mb-3 space-y-1.5 border-b border-line pb-3">
              {(data.liabilities || []).map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-2 font-mono text-[12px]"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-fg">{l.name}</span>
                    <span className="ml-2 tabular-nums text-loss">
                      {formatUsd(toUsd(l.balance, l.currency, data.fx.average))}
                    </span>
                    {l.interestRate != null ? (
                      <span className="ml-2 text-subtle">
                        {l.interestRate}%
                      </span>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Eliminar"
                    onClick={async () => {
                      try {
                        await deleteLiability({ data: { id: l.id } });
                        toast.success("Deuda eliminada");
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
          ) : (
            <p className="mb-3 font-mono text-[12px] text-subtle">
              Sin deudas cargadas.
            </p>
          )}
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!liabName.trim()) {
                toast.error("Nombre requerido");
                return;
              }
              const bal = Number(liabBal);
              if (!bal || bal < 0) {
                toast.error("Balance inválido");
                return;
              }
              setLiabPending(true);
              try {
                await upsertLiability({
                  data: {
                    name: liabName.trim(),
                    type: "loan",
                    balance: bal,
                    currency: liabCur,
                    interestRate: liabRate ? Number(liabRate) : null,
                  },
                });
                toast.success("Deuda agregada");
                setLiabName("");
                setLiabBal("");
                setLiabRate("");
                await router.invalidate();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Error");
              } finally {
                setLiabPending(false);
              }
            }}
          >
            <Field label="Nombre">
              <Input
                value={liabName}
                onChange={(e) => setLiabName(e.target.value)}
                placeholder="Hipoteca / Préstamo"
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Balance">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={liabBal}
                  onChange={(e) => setLiabBal(e.target.value)}
                />
              </Field>
              <Field label="Moneda">
                <Select
                  value={liabCur}
                  onChange={(e) => setLiabCur(e.target.value)}
                >
                  <option>USD</option>
                  <option>ARS</option>
                  <option>EUR</option>
                </Select>
              </Field>
              <Field label="Tasa %">
                <Input
                  type="number"
                  step="any"
                  value={liabRate}
                  onChange={(e) => setLiabRate(e.target.value)}
                />
              </Field>
            </div>
            <Button
              type="submit"
              className="justify-self-start"
              disabled={liabPending}
            >
              {liabPending ? "…" : "Agregar deuda"}
            </Button>
          </form>
        </Monitor>

        <Monitor title="ALLOC TARGETS">
          <p className="mb-3 font-mono text-[12px] text-muted">
            % objetivo por asset class. Ideal = 100%.
          </p>
          <form
            className="grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setAllocPending(true);
              try {
                await setAllocTargets({
                  data: {
                    targets: ASSET_TYPES.map((t) => ({
                      assetType: t,
                      targetPct: Number(allocDraft[t]) || 0,
                    })),
                  },
                });
                toast.success("Targets guardados");
                await router.invalidate();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Error");
              } finally {
                setAllocPending(false);
              }
            }}
          >
            {ASSET_TYPES.map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className="w-28 shrink-0 font-mono text-[12px] text-muted">
                  {t}
                </span>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="w-24"
                  value={allocDraft[t]}
                  onChange={(e) =>
                    setAllocDraft((prev) => ({ ...prev, [t]: e.target.value }))
                  }
                />
                <span className="font-mono text-[11px] text-subtle">%</span>
              </div>
            ))}
            <div
              className={`mt-1 font-mono text-[12px] ${Math.abs(allocSum - 100) < 0.5 ? "text-gain" : "text-subtle"}`}
            >
              Suma: {allocSum.toFixed(1)}%
            </div>
            <Button
              type="submit"
              className="justify-self-start"
              disabled={allocPending}
            >
              {allocPending ? "…" : "Guardar targets"}
            </Button>
          </form>
        </Monitor>

        <Monitor title="PASSWORD LOCK">
          <p className="mb-3 font-mono text-[12px] text-muted">
            Estado:{" "}
            <span className={pinOn ? "text-gain" : "text-subtle"}>
              {pinOn ? "ACTIVO" : "OFF"}
            </span>
            {" · "}con el lock activo, toda la API exige sesión (cookie
            HttpOnly, 30 días).
          </p>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (newPin.length < 4) {
                toast.error("Mínimo 4 caracteres");
                return;
              }
              if (newPin !== confirmPin) {
                toast.error("No coinciden");
                return;
              }
              setPinPending(true);
              try {
                await setPin({ data: { pin: newPin } });
                toast.success(
                  pinOn ? "Password cambiado" : "Password activado",
                );
                setNewPin("");
                setConfirmPin("");
                await router.invalidate();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Error");
              } finally {
                setPinPending(false);
              }
            }}
          >
            <Field label={pinOn ? "Nuevo password" : "Password"}>
              <Input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
              />
            </Field>
            <Field label="Confirmar">
              <Input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pinPending}>
                {pinPending ? "…" : pinOn ? "Cambiar" : "Activar"}
              </Button>
              {pinOn ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pinPending}
                  onClick={async () => {
                    setPinPending(true);
                    try {
                      await setPin({ data: { pin: null } });
                      toast.success("Desactivado");
                      await router.invalidate();
                    } finally {
                      setPinPending(false);
                    }
                  }}
                >
                  Desactivar
                </Button>
              ) : null}
            </div>
          </form>
        </Monitor>

        <Monitor title="FX">
          <p className="mb-3 font-mono text-[12px] text-muted">
            ARS = AVG(OFICIAL, BLUE, MEP)
          </p>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              try {
                await updateFx({
                  data: {
                    official: Number(official) || 0,
                    blue: Number(blue) || 0,
                    mep: Number(mep) || 0,
                  },
                });
                toast.success("FX actualizado");
                await router.invalidate();
              } finally {
                setPending(false);
              }
            }}
          >
            <Field label="Oficial">
              <Input
                type="number"
                step="any"
                value={official}
                onChange={(e) => setOfficial(e.target.value)}
              />
            </Field>
            <Field label="Blue">
              <Input
                type="number"
                step="any"
                value={blue}
                onChange={(e) => setBlue(e.target.value)}
              />
            </Field>
            <Field label="MEP">
              <Input
                type="number"
                step="any"
                value={mep}
                onChange={(e) => setMep(e.target.value)}
              />
            </Field>
            <div className="bg-raised px-3 py-2 font-mono text-xs">
              Promedio:{" "}
              <span className="tabular-nums text-fg">{avg.toFixed(2)}</span>
            </div>
            <Button
              type="submit"
              className="justify-self-start"
              disabled={pending}
            >
              {pending ? "…" : "Guardar FX"}
            </Button>
          </form>
          {fxHistAsc.length > 1 ? (
            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-2 font-mono text-[11px] tracking-widest text-accent">
                FX HISTORY
              </p>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={fxHistAsc}
                    margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#6b7280", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        background: "#000",
                        border: "1px solid #ff6d00",
                        borderRadius: 0,
                        fontSize: 11,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="official"
                      stroke="#6b7280"
                      dot={false}
                      strokeWidth={1}
                    />
                    <Line
                      type="monotone"
                      dataKey="blue"
                      stroke="#3b82f6"
                      dot={false}
                      strokeWidth={1.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="mep"
                      stroke="#22c55e"
                      dot={false}
                      strokeWidth={1}
                    />
                    <Line
                      type="monotone"
                      dataKey="average"
                      stroke="#ff6d00"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="mt-3 font-mono text-[11px] text-subtle">
              Guardá FX varias veces para historial.
            </p>
          )}
        </Monitor>

        <Monitor
          title="WATCHLIST"
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={wPending || !(data.watchlist || []).length}
              onClick={async () => {
                setWPending(true);
                try {
                  const r = await refreshWatchlistPrices();
                  toast.success(`Updated ${r.updated}`);
                  await router.invalidate();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Error");
                } finally {
                  setWPending(false);
                }
              }}
            >
              <RefreshCw
                className={`size-3 ${wPending ? "animate-spin" : ""}`}
              />{" "}
              REFRESH
            </Button>
          }
        >
          {(data.watchlist || []).length > 0 ? (
            <ul className="mb-3 space-y-1 border-b border-line pb-3">
              {(data.watchlist || []).map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between gap-2 font-mono text-[12px]"
                >
                  <div>
                    <span className="text-fg">{w.ticker}</span>
                    {w.name ? (
                      <span className="ml-2 text-subtle">{w.name}</span>
                    ) : null}
                    {w.lastPrice != null ? (
                      <span className="ml-2 tabular-nums text-accent">
                        {formatUsd(w.lastPrice, 2)}
                      </span>
                    ) : (
                      <span className="ml-2 text-subtle">—</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Quitar"
                    onClick={async () => {
                      try {
                        await deleteWatchItem({ data: { id: w.id } });
                        toast.success("Quitado");
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
          ) : (
            <p className="mb-3 font-mono text-[12px] text-subtle">
              Sin tickers.
            </p>
          )}
          <form
            className="grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!wTicker.trim()) {
                toast.error("Ticker requerido");
                return;
              }
              setWPending(true);
              try {
                await upsertWatchItem({
                  data: {
                    ticker: wTicker.trim(),
                    name: wName || null,
                    type: wType,
                  },
                });
                toast.success("Agregado");
                setWTicker("");
                setWName("");
                await router.invalidate();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Error");
              } finally {
                setWPending(false);
              }
            }}
          >
            <div className="grid grid-cols-3 gap-2">
              <Field label="Ticker">
                <Input
                  value={wTicker}
                  onChange={(e) => setWTicker(e.target.value)}
                  placeholder="AAPL"
                />
              </Field>
              <Field label="Nombre">
                <Input
                  value={wName}
                  onChange={(e) => setWName(e.target.value)}
                />
              </Field>
              <Field label="Tipo">
                <Select
                  value={wType}
                  onChange={(e) => setWType(e.target.value)}
                >
                  <option value="STOCK">STOCK</option>
                  <option value="CRYPTO">CRYPTO</option>
                  <option value="BOND">BOND</option>
                </Select>
              </Field>
            </div>
            <Button
              type="submit"
              className="justify-self-start"
              disabled={wPending}
            >
              {wPending ? "…" : "Agregar"}
            </Button>
          </form>
        </Monitor>

        <Monitor title="HISTORIAL DE NET WORTH">
          <p className="mb-2 font-mono text-[12px] text-muted">
            Los snapshots solo se acumulan desde que la app corre, así que NW
            SERIES y DRAWDOWN arrancan vacíos. Pegá el histórico que tengas, una
            línea por día: <span className="text-fg">fecha,valor</span> en USD.
          </p>
          <p className="mb-2 font-mono text-[11px] text-subtle">
            {data.snapshots.length} punto
            {data.snapshots.length === 1 ? "" : "s"} cargado
            {data.snapshots.length === 1 ? "" : "s"}
            {data.snapshots.length > 0
              ? ` · ${data.snapshots[0].date} → ${data.snapshots[data.snapshots.length - 1].date}`
              : ""}
          </p>
          <Textarea
            rows={5}
            value={snapshotCsv}
            onChange={(e) => setSnapshotCsv(e.target.value)}
            placeholder={"2025-01-31,180000\n2025-02-28,184500"}
            className="mb-2"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={snapBusy || !snapshotCsv.trim()}
              onClick={async () => {
                const rows: { date: string; totalUsd: number }[] = [];
                const bad: string[] = [];
                for (const raw of snapshotCsv.split(/\r?\n/)) {
                  const line = raw.trim();
                  if (!line || /^fecha|^date/i.test(line)) continue;
                  const [d, v] = line.split(/[,;\t]/);
                  const date = (d || "").trim();
                  // Tolerate "1.234,56" and "1,234.56" alike: drop thousands
                  // separators, then normalise the decimal comma.
                  const num = Number(
                    (v || "")
                      .trim()
                      .replace(/[^0-9,.-]/g, "")
                      .replace(/\.(?=\d{3}\b)/g, "")
                      .replace(",", "."),
                  );
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(num) || num < 0) {
                    bad.push(line);
                    continue;
                  }
                  rows.push({ date, totalUsd: num });
                }
                if (rows.length === 0) {
                  toast.error("Ninguna línea válida (formato: 2025-01-31,180000)");
                  return;
                }
                setSnapBusy(true);
                try {
                  const res = await backfillSnapshots({ data: { rows } });
                  await router.invalidate();
                  setSnapshotCsv("");
                  toast.success(
                    `${res.written} snapshot${res.written === 1 ? "" : "s"} guardado${res.written === 1 ? "" : "s"}` +
                      (bad.length ? ` · ${bad.length} línea(s) ignorada(s)` : ""),
                  );
                } catch {
                  toast.error("No se pudo guardar el historial");
                } finally {
                  setSnapBusy(false);
                }
              }}
            >
              {snapBusy ? "Guardando…" : "Cargar historial"}
            </Button>
            <span className="font-mono text-[11px] text-subtle">
              una fecha repetida pisa el valor anterior
            </span>
          </div>
        </Monitor>

        <Monitor title="EXPORT">
          <p className="mb-3 font-mono text-[12px] text-muted">
            Backup JSON / CSV ledger / print PDF.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `patrimonio-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("JSON descargado");
              }}
            >
              Export JSON
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const rows = [
                  [
                    "date",
                    "description",
                    "amount",
                    "currency",
                    "type",
                    "category",
                  ].join(","),
                  ...data.transactions.map((tx) =>
                    [
                      tx.date,
                      `"${(tx.description || "").replace(/"/g, '""')}"`,
                      tx.amount,
                      tx.currency,
                      tx.type,
                      tx.category || "",
                    ].join(","),
                  ),
                ];
                const blob = new Blob([rows.join("\n")], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `ledger-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("CSV descargado");
              }}
            >
              Export CSV
            </Button>
            <Button type="button" onClick={() => window.print()}>
              Print / PDF
            </Button>
          </div>
        </Monitor>
      </div>
    </div>
  );
}
