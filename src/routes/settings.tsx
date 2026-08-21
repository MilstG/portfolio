import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { getPortfolio, updateFx } from "@/lib/server/portfolio";

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

  return (
    <div className="max-w-md">
      <h1 className="font-mono text-sm tracking-widest text-accent">FX</h1>
      <p className="mt-1 font-mono text-[11px] text-muted">
        ARS = AVG(OFICIAL, BLUE, MEP)
      </p>

      <form
        className="mt-3 grid gap-3 border border-border bg-surface p-3"
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
          <Input type="number" step="any" value={official} onChange={(e) => setOfficial(e.target.value)} />
        </Field>
        <Field label="Blue">
          <Input type="number" step="any" value={blue} onChange={(e) => setBlue(e.target.value)} />
        </Field>
        <Field label="MEP">
          <Input type="number" step="any" value={mep} onChange={(e) => setMep(e.target.value)} />
        </Field>
        <div className="rounded-md bg-raised px-3 py-3 text-sm">
          Promedio usado: <span className="tabular-nums text-fg">{avg.toFixed(2)}</span> ARS / USD
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </div>
  );
}
