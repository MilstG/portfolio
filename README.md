# Patrimonio

Tracker personal de patrimonio (crypto, acciones, bonos, real estate, cash y flujo de fondos)
con UI estilo terminal. TanStack Start + React 19 + Tailwind 4, datos en **PostgreSQL**.

## Stack

| Capa | Qué |
|---|---|
| App | [TanStack Start](https://tanstack.com/start) (router + server functions), React 19, Tailwind 4 |
| Server | Nitro (`node-server`), `pg` contra Postgres. Sin `DATABASE_URL` usa PGLite embebido (en memoria) |
| Schema | `migrations/*.sql`, aplicadas en orden por `scripts/migrate.mjs` (deploy) y por `src/lib/db.ts` (PGLite) |
| Auth | PIN opcional → sesión server-side (cookie HttpOnly, 30 días). Ver `src/lib/auth.server.ts` |

## Estructura

```
migrations/          schema + seeds (una sola fuente de verdad)
scripts/migrate.mjs  migrador para deploy (npm start lo corre antes de levantar)
src/routes/          páginas: / (MONIT), /assets, /cash, /cashflow, /settings, /login
src/lib/server/      server functions (portfolio.ts, extra-actions.ts, auth.ts)
src/lib/             db.ts, auth.server.ts, portfolio-math.ts, analytics.ts, prices.ts
src/components/      shell, dashboard-grid, forms, ui/ (button, dialog, input, monitor, pager, tip)
public/              favicon, manifest PWA, íconos
```

## Local

```bash
npm install
cp .env.example .env      # dejá DATABASE_URL vacío para usar PGLite en memoria
npm run dev               # http://localhost:8080
```

Checks: `npm run typecheck`, `npm run lint`, `npm run build` (+ `npm run preview`).

## Railway

- **Build**: `npm run build` · **Start**: `npm start` (corre migraciones y levanta `.output/server/index.mjs`).
- Variables del servicio: `DATABASE_URL` (referencia al plugin Postgres). Opcional `PGSSL=true`.
- Node 22+ (`.nvmrc`, `nixpacks.toml`).

## Seguridad

- Con el PIN activado (CFG → PASSWORD LOCK) **todos** los server functions exigen una sesión válida
  (`requireAuth` en `src/lib/server/auth.ts`). Sin PIN la app queda abierta: es una herramienta
  de un solo usuario, activalo antes de exponerla a internet.
- Hash del PIN: scrypt + salt. 5 intentos fallidos → bloqueo de 1 min con backoff exponencial.
- Cambiar o quitar el PIN revoca todas las sesiones.
- Headers: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
