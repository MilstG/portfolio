import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { getPortfolio, setPin, updateFx } from "@/lib/server/portfolio";

export const Route = createFileRoute("/settings")({
  loader: () => getPortfolio(),
  component: SettingsPage,
});

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

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div>
        <h1 className="font-mono text-sm tracking-widest text-accent">SETTINGS</h1>
        <p className="mt-1 font-mono text-[11px] text-muted">FX · PASSWORD</p>
      </div>

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
              // force re-lock next full reload by clearing session flag? keep unlocked this session
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
