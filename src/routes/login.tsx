import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { login } from "@/lib/server/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <form
        className="w-full max-w-xs border border-border bg-surface p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setPending(true);
          try {
            const r = await login({ data: { pin } });
            if (r.ok) {
              await router.invalidate();
              await router.navigate({ to: "/" });
            } else if (r.retryIn && r.retryIn > 0) {
              setError(`Demasiados intentos. Esperá ${r.retryIn}s.`);
            } else {
              setError("Password incorrecto");
              setPin("");
            }
          } catch {
            setError("No se pudo verificar");
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="bg-accent px-2 font-mono text-xs font-semibold tracking-widest text-accent-fg">
            PAT
          </span>
          <span className="font-mono text-xs tracking-widest text-accent">
            PATRIMONIO
          </span>
        </div>
        <p className="mb-3 font-mono text-[12px] tracking-widest text-muted">
          PASSWORD REQUIRED
        </p>
        <Field label="Password">
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        {error ? (
          <p className="mt-2 font-mono text-[12px] text-loss" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          className="mt-3 w-full"
          disabled={pending || !pin}
        >
          {pending ? "…" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}
