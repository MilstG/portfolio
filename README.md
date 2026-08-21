# Patrimonio – Tracker de Assets Personales

App de finanzas personales para trackear crypto, stocks, bonos, real estate, múltiples cuentas de cash e ingresos recurrentes.

## Stack
- Next.js 15 + Tailwind CSS 4 + Recharts
- Prisma + PostgreSQL
- Deploy en Railway

---

## Cómo deployar en Railway (paso a paso)

### 1. Crear cuenta y proyecto en Railway
1. Andá a https://railway.app y creá una cuenta (podés usar GitHub).
2. Click en **New Project**.

### 2. Agregar la base de datos Postgres
1. Dentro del proyecto → **+ New** → **Database** → **PostgreSQL**.
2. Esperá a que se cree.
3. Click en la base de datos → pestaña **Variables** o **Connect**.
4. Copiá la variable `DATABASE_URL` (o `POSTGRES_URL`).  
   Se ve algo así:  
   `postgresql://postgres:xxxx@hostname:port/railway`

### 3. Deployar la app desde GitHub (recomendado)
1. Subí este código a un repositorio de GitHub.
2. En Railway → **+ New** → **GitHub Repo** → elegí el repo.
3. Railway detecta que es Next.js automáticamente.

### 4. Configurar variables de entorno
En el servicio de la **app** (no de la base de datos):

1. Andá a **Variables**.
2. Agregá:

| Variable       | Valor                                      |
|----------------|--------------------------------------------|
| `DATABASE_URL` | La misma que copiaste de la base Postgres  |

(Railway a veces tiene un botón “Add Reference” para linkear la variable automáticamente entre servicios. Usalo si aparece.)

### 5. Generar las tablas y cargar datos de ejemplo
Una vez que el deploy terminó:

1. En Railway abrí la pestaña **Settings** del servicio de la app.
2. O usá el terminal de Railway (o desde tu máquina local con la DATABASE_URL):

```bash
npx prisma db push
npx prisma db seed
```

Esto crea todas las tablas y carga los datos de ejemplo (Bitcoin, depto, cuentas, etc.).

### 6. Listo
Tu app va a estar en una URL tipo:
`https://patrimonio-production-xxxx.up.railway.app`

---

## Desarrollo local

```bash
npm install
cp .env.example .env
# Editá .env y pegá tu DATABASE_URL de Railway

npx prisma db push
npx prisma db seed
npm run dev
```

Abrí http://localhost:3000

---

## Estructura de la app

- `/` → Dashboard
- `/assets` → Lista de assets + botón “Agregar Asset”
- `/assets/[id]` → Detalle + ingresos recurrentes
- `/cash` → Cuentas de cash individuales + botón “Agregar Cuenta”
- `/cashflow` → Ingresos y gastos
- `/settings` → Configuración

---

## Notas importantes

- El tipo de cambio usado es el **promedio** de Oficial + Blue + MEP.
- Los formularios de “Agregar” por ahora guardan en memoria (mock).  
  En la próxima iteración se conectan a la base real vía Server Actions.
- El schema de Prisma ya está 100% listo para producción.
