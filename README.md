# Patrimonio

Tracker de patrimonio (crypto, acciones, bonos, real estate, cash, flujo).
UI tipo terminal. Datos en **PostgreSQL**.

## Railway

El repo ya no es Next.js. El start command es el servidor Nitro.

### Variables

En el servicio de la **app** (no en el plugin de Postgres):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | referencia a la Postgres de Railway |

Si Railway no la linkeó: Variables → Add Reference → `DATABASE_URL` del plugin Postgres.

Opcional: `PGSSL=true` si el proxy público exige SSL.

### Deploy

1. Railway sigue apuntando a este repo. Al pushear `main` rebuilda solo.
2. El build corre `vite build` y después `npm run db:migrate` (crea las tablas).
3. Start command (ya está en `railway.json`): `node .output/server/index.mjs`

Si el servicio todavía tiene settings de Next.js:

- **Settings → Build**: Build Command = `npm run build`
- **Settings → Deploy**: Start Command = `node .output/server/index.mjs`
- Node 20+

La primera migración **borra** las tablas viejas de Prisma y crea el schema nuevo, con seed de ejemplo. Tus rows de la versión anterior no se migran.

### Local

```bash
npm install
cp .env.example .env
# pegá DATABASE_URL de Railway, o dejalo vacío (usa Postgres embebido)
npm run dev
```
