import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { getPortfolio, verifyPin } from "@/lib/server/portfolio";

const SESSION_KEY = "patrimonio_pin_ok";

export function PinGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1") {
          if (!cancelled) {
            setLocked(false);
            setReady(true);
          }
          return;
        }
        const p = await getPortfolio();
        if (!cancelled) {
          setLocked(Boolean(p.settings?.pinEnabled && p.settings?.hasPin));
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setLocked(false);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg font-mono text-xs text-muted">
        …
      </div>
    );
  }

  if (locked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
        <form
          className="w-full max-w-xs border border-border bg-surface p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const r = await verifyPin({ data: { pin } });
            if (r.ok) {
              sessionStorage.setItem(SESSION_KEY, "1");
              setLocked(false);
            } else {
              setError("PIN incorrecto");
            }
          }}
        >
          <p className="mb-3 font-mono text-xs tracking-widest text-accent">PIN REQUIRED</p>
          <Field label="PIN">
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </Field>
          {error ? <p className="mt-2 font-mono text-[11px] text-loss">{error}</p> : null}
          <Button type="submit" className="mt-3 w-full">
            Unlock
          </Button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
