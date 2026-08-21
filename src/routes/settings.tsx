import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import {
  deleteAllocTarget,
  deleteGoal,
  getPortfolio,
  setPin,
  updateFx,
  upsertAllocTarget,
  upsertGoal,
} from "@/lib/server/portfolio";
import { formatUsd } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  loader: () => getPortfolio(),
  component: SettingsPage,
});

const ASSET_TYPES = ["CRYPTO", "STOCK", "BOND", "REAL_ESTATE", "CASH", "OTHER"] as const;

function SettingsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [official, setOfficial] = useState(String(data.fx.official));
  const [blue, setBlue] = useState(String(data.fx.blue));
  const [mep, setMep] = useState(String(data.fx.mep));
  const [pending, setPending] = useState(false);
  const avg = ((Number(official) || 0) + (Number(blue) || 0) + (Number(mep) || 0)) / 3;

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinPending, setPinPending] = useState(false);
  const pinOn = Boolean(data.settings?.pinEnabled && data.settings?.hasPin);

  // Goals form
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalNotes, setGoalNotes] = useState("");
  const [goalPending, setGoalPending] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // Alloc targets — local editable map
  const [allocDraft, setAllocDraft] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const t of ASSET_TYPES) {
      const found = data.allocTargets.find((a) => a.assetType === t);
      m[t] = found ? String(found.targetPct) : "0";
    }
    return m;
  });
  const [allocPending, setAllocPending] = useState(false);
  const allocSum = ASSET_TYPES.reduce((s, t) => s + (Number(allocDraft[t]) || 0), 0);

  function resetGoalForm() {
    setGoalName("");
    setGoalTarget("");
    setGoalDate("");
    setGoalNotes("");
    setEditingGoalId(null);
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 pb-8">
      <div>
        <h1 className="font-mono text-sm tracking-widest text-accent">SETTINGS</h1>
        <p className="mt-1 font-mono text-[11px] text-muted">FX · PASSWORD · GOALS · ALLOC TARGETS</p>
      </div>

      {/* ── GOALS ──────────────────────────────────────────────── */}
      <section className="border border-border bg-surface p-3">
        <h2 className="mb-1 font-mono text-[10px] tracking-widest text-accent">GOALS</h2>
        <p className="mb-3 font-mono text-[11px] text-muted">
          Objetivos de patrimonio en USD. El panel GOALS del dashboard mide progreso vs net worth.
        </p>

        {data.goals.length > 0 ? (
          <ul className="mb-3 space-y-1.5 border-b border-line pb-3">
            {data.goals.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-2 font-mono text-[11px]"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-fg">{g.name}</span>
                  <span className="ml-2 tabular-nums text-accent">{formatUsd(g.targetUsd)}</span>
                  {g.targetDate ? (
                    <span className="ml-2 text-subtle">{g.targetDate}</span>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingGoalId(g.id);
                      setGoalName(g.name);
                      setGoalTarget(String(g.targetUsd));
                      setGoalDate(g.targetDate || "");
                      setGoalNotes(g.notes || "");
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      try {
                        await deleteGoal({ data: { id: g.id } });
                        toast.success("Goal eliminado");
                        if (editingGoalId === g.id) resetGoalForm();
                        await router.invalidate();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Error");
                      }
                    }}
                  >
                    Del
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 font-mono text-[11px] text-subtle">Sin goals todavía.</p>
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
              toast.success(editingGoalId ? "Goal actualizado" : "Goal creado");
              resetGoalForm();
              await router.invalidate();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "No se pudo guardar");
            } finally {
              setGoalPending(false);
            }
          }}
        >
          <Field label={editingGoalId ? "Editar goal" : "Nuevo goal"}>
            <Input
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="Ej: FIRE 1M / Casa / Reserva"
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
                placeholder="1000000"
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
              placeholder="Opcional"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={goalPending}>
              {goalPending ? "…" : editingGoalId ? "Guardar cambios" : "Agregar goal"}
            </Button>
            {editingGoalId ? (
              <Button type="button" variant="secondary" onClick={resetGoalForm}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      {/* ── ALLOC TARGETS ──────────────────────────────────────── */}
      <section className="border border-border bg-surface p-3">
        <h2 className="mb-1 font-mono text-[10px] tracking-widest text-accent">ALLOC TARGETS</h2>
        <p className="mb-3 font-mono text-[11px] text-muted">
          % objetivo por asset class. Alimenta ALLOC vs TARGET y REBALANCE del dashboard. Suma ideal =
          100%.
        </p>

        <form
          className="grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setAllocPending(true);
            try {
              for (const t of ASSET_TYPES) {
                const pct = Number(allocDraft[t]) || 0;
                await upsertAllocTarget({ data: { assetType: t, targetPct: pct } });
              }
              toast.success("Targets guardados");
              await router.invalidate();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Error al guardar");
            } finally {
              setAllocPending(false);
            }
          }}
        >
          {ASSET_TYPES.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className="w-28 shrink-0 font-mono text-[11px] text-muted">{t}</span>
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
              <span className="font-mono text-[10px] text-subtle">%</span>
            </div>
          ))}
          <div
            className={`mt-1 font-mono text-[11px] ${
              Math.abs(allocSum - 100) < 0.5 ? "text-gain" : "text-subtle"
            }`}
          >
            Suma: {allocSum.toFixed(1)}%
            {Math.abs(allocSum - 100) >= 0.5 ? " (ideal 100%)" : " ✓"}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button type="submit" disabled={allocPending}>
              {allocPending ? "…" : "Guardar targets"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={allocPending}
              onClick={async () => {
                setAllocPending(true);
                try {
                  const zero: Record<string, string> = {};
                  for (const t of ASSET_TYPES) {
                    zero[t] = "0";
                    await upsertAllocTarget({ data: { assetType: t, targetPct: 0 } });
                  }
                  setAllocDraft(zero);
                  toast.success("Targets en cero");
                  await router.invalidate();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Error");
                } finally {
                  setAllocPending(false);
                }
              }}
            >
              Reset 0%
            </Button>
          </div>
        </form>
      </section>

      {/* ── PASSWORD ───────────────────────────────────────────── */}
      <section className="border border-border bg-surface p-3">
        <h2 className="mb-3 font-mono text-[10px] tracking-widest text-accent">PASSWORD LOCK</h2>
        <p className="mb-3 font-mono text-[11px] text-muted">
          Estado:{" "}
          <span className={pinOn ? "text-gain" : "text-subtle"}>
            {pinOn ? "ACTIVO" : "OFF"}
          </span>
          {pinOn
            ? " — la app pide password al abrir (sesión del navegador)."
            : " — cualquiera con el link ve el patrimonio."}
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
              toast.success("Password activado");
              setNewPin("");
              setConfirmPin("");
              await router.invalidate();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "No se pudo guardar");
            } finally {
              setPinPending(false);
            }
          }}
        >
          <Field label={pinOn ? "Nuevo password" : "Password (4–32 chars)"}>
            <Input
              type="password"
              autoComplete="new-password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Confirmar">
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pinPending}>
              {pinPending ? "…" : pinOn ? "Cambiar password" : "Activar password"}
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
                    try {
                      sessionStorage.removeItem("patrimonio_pin_ok");
                    } catch {
                      /* ignore */
                    }
                    toast.success("Password desactivado");
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
                Desactivar
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      {/* ── FX ─────────────────────────────────────────────────── */}
      <section className="border border-border bg-surface p-3">
        <h2 className="mb-1 font-mono text-[10px] tracking-widest text-accent">FX</h2>
        <p className="mb-3 font-mono text-[11px] text-muted">ARS = AVG(OFICIAL, BLUE, MEP)</p>

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
              toast.success("Tipo de cambio actualizado");
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
            <Input type="number" step="any" value={blue} onChange={(e) => setBlue(e.target.value)} />
          </Field>
          <Field label="MEP">
            <Input type="number" step="any" value={mep} onChange={(e) => setMep(e.target.value)} />
          </Field>
          <div className="bg-raised px-3 py-3 font-mono text-sm">
            Promedio usado: <span className="tabular-nums text-fg">{avg.toFixed(2)}</span> ARS / USD
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar FX"}
          </Button>
        </form>
      </section>
    </div>
  );
}
