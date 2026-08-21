import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UNAUTHORIZED } from "@/lib/server/auth";

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const unauthorized = error.message.includes(UNAUTHORIZED);
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <TriangleAlert className="size-8 text-loss" aria-hidden="true" />
      <h1 className="font-mono text-sm tracking-widest text-accent">
        {unauthorized ? "SESIÓN EXPIRADA" : "ALGO SALIÓ MAL"}
      </h1>
      <p className="max-w-md font-mono text-xs break-words text-muted">
        {unauthorized
          ? "Volvé a ingresar el password."
          : error.message || "Error inesperado."}
      </p>
      <Button
        variant="secondary"
        onClick={() => {
          if (unauthorized) {
            window.location.assign("/login");
            return;
          }
          reset();
          void router.invalidate();
        }}
      >
        {unauthorized ? "Ir al login" : "Reintentar"}
      </Button>
    </main>
  );
}
