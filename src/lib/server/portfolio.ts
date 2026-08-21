import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { num } from "@/lib/utils";
import { netWorthUsd } from "@/lib/portfolio-math";
import type { Account, Asset, Fx, Portfolio, RecurringIncome, Snapshot, Tx } from "@/lib/types";

function mapAsset(r: Record<string, unknown>): Asset {
  return {
    id: String(r.id),
    name: String(r.name),
    ticker: r.ticker == null ? null : String(r.ticker),
    type: String(r.type),
    quantity: r.quantity == null ? null : num(r.quantity),
    costBasis: num(r.cost_basis),
    currentValue: num(r.current_value),
    currency: String(r.currency),
    purchaseDate: r.purchase_date == null ? null : String(r.purchase_date).slice(0, 10),
    notes: r.notes == null ? null : String(r.notes),
  };
}

function mapAccount(r: Record<string, unknown>): Account {
  return {
    id: String(r.id),
    name: String(r.name),
    institution: r.institution == null ? null : String(r.institution),
    type: String(r.type),
    currency: String(r.currency),
    balance: num(r.balance),
    notes: r.notes == null ? null : String(r.notes),
  };
}

function mapRec(r: Record<string, unknown>): RecurringIncome {
  return {
    id: String(r.id),
    assetId: String(r.asset_id),
    name: String(r.name),
    amount: num(r.amount),
    currency: String(r.currency),
    frequency: String(r.frequency),
    nextDate: String(r.next_date).slice(0, 10),
    notes: r.notes == null ? null : String(r.notes),
  };
}

function mapTx(r: Record<string, unknown>): Tx {
  return {
    id: String(r.id),
    date: String(r.date).slice(0, 10),
    description: String(r.description),
    amount: num(r.amount),
    currency: String(r.currency),
    type: String(r.type),
    category: r.category == null ? null : String(r.category),
    assetId: r.asset_id == null ? null : String(r.asset_id),
    accountId: r.account_id == null ? null : String(r.account_id),
  };
}

async function loadFx(): Promise<Fx> {
  const sql = await getSql();
  const rows = await sql`select official, blue, mep from fx_rates where id = 1`;
  const r = rows[0] ?? { official: 1420, blue: 1480, mep: 1455 };
  const official = num(r.official);
  const blue = num(r.blue);
  const mep = num(r.mep);
  return { official, blue, mep, average: (official + blue + mep) / 3 };
}

async function loadPortfolioInner(): Promise<Portfolio> {
  const sql = await getSql();
  const [assetRows, accRows, recRows, txRows, snapRows, fx] = await Promise.all([
    sql`select * from assets order by current_value desc`,
    sql`select * from accounts order by name`,
    sql`select * from recurring_incomes order by next_date`,
    sql`select * from transactions order by date desc, created_at desc limit 40`,
    sql`select date, total_usd from snapshots order by date asc`,
    loadFx(),
  ]);
  return {
    assets: assetRows.map(mapAsset),
    accounts: accRows.map(mapAccount),
    recurring: recRows.map(mapRec),
    transactions: txRows.map(mapTx),
    snapshots: snapRows.map((r) => ({
      date: String(r.date).slice(0, 10),
      totalUsd: num(r.total_usd),
    })) as Snapshot[],
    fx,
  };
}

async function writeTodaySnapshot() {
  const sql = await getSql();
  const portfolio = await loadPortfolioInner();
  const total = netWorthUsd(portfolio);
  const today = new Date().toISOString().slice(0, 10);
  await sql.query(
    `insert into snapshots (date, total_usd) values ($1, $2)
     on conflict (date) do update set total_usd = excluded.total_usd`,
    [today, total],
  );
}

export const getPortfolio = createServerFn({ method: "GET" }).handler(async () => {
  return loadPortfolioInner();
});

export const getAsset = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql`select * from assets where id = ${data.id}`;
    if (!rows[0]) return null;
    const rec = await sql`select * from recurring_incomes where asset_id = ${data.id} order by next_date`;
    return { asset: mapAsset(rows[0]), recurring: rec.map(mapRec) };
  });

const assetInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  ticker: z.string().optional().nullable(),
  type: z.string(),
  quantity: z.number().nullable().optional(),
  costBasis: z.number(),
  currentValue: z.number(),
  currency: z.string(),
  purchaseDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const upsertAsset = createServerFn({ method: "POST" })
  .validator(assetInput)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id || crypto.randomUUID();
    await sql.query(
      `insert into assets (id, name, ticker, type, quantity, cost_basis, current_value, currency, purchase_date, notes, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
       on conflict (id) do update set
         name = excluded.name,
         ticker = excluded.ticker,
         type = excluded.type,
         quantity = excluded.quantity,
         cost_basis = excluded.cost_basis,
         current_value = excluded.current_value,
         currency = excluded.currency,
         purchase_date = excluded.purchase_date,
         notes = excluded.notes,
         updated_at = now()`,
      [
        id,
        data.name.trim(),
        data.ticker?.trim() || null,
        data.type,
        data.quantity ?? null,
        data.costBasis,
        data.currentValue,
        data.currency,
        data.purchaseDate || null,
        data.notes || null,
      ],
    );
    await writeTodaySnapshot();
    return { id };
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from assets where id = ${data.id}`;
    await writeTodaySnapshot();
    return { ok: true };
  });

const accountInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  institution: z.string().optional().nullable(),
  type: z.string(),
  currency: z.string(),
  balance: z.number(),
  notes: z.string().optional().nullable(),
});

export const upsertAccount = createServerFn({ method: "POST" })
  .validator(accountInput)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id || crypto.randomUUID();
    await sql.query(
      `insert into accounts (id, name, institution, type, currency, balance, notes, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7, now())
       on conflict (id) do update set
         name = excluded.name,
         institution = excluded.institution,
         type = excluded.type,
         currency = excluded.currency,
         balance = excluded.balance,
         notes = excluded.notes,
         updated_at = now()`,
      [
        id,
        data.name.trim(),
        data.institution || null,
        data.type,
        data.currency,
        data.balance,
        data.notes || null,
      ],
    );
    await writeTodaySnapshot();
    return { id };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from accounts where id = ${data.id}`;
    await writeTodaySnapshot();
    return { ok: true };
  });

const recInput = z.object({
  id: z.string().optional(),
  assetId: z.string(),
  name: z.string().min(1),
  amount: z.number(),
  currency: z.string(),
  frequency: z.string(),
  nextDate: z.string(),
});

export const upsertRecurring = createServerFn({ method: "POST" })
  .validator(recInput)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id || crypto.randomUUID();
    await sql.query(
      `insert into recurring_incomes (id, asset_id, name, amount, currency, frequency, next_date)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (id) do update set
         name = excluded.name,
         amount = excluded.amount,
         currency = excluded.currency,
         frequency = excluded.frequency,
         next_date = excluded.next_date`,
      [id, data.assetId, data.name.trim(), data.amount, data.currency, data.frequency, data.nextDate],
    );
    return { id };
  });

export const deleteRecurring = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from recurring_incomes where id = ${data.id}`;
    return { ok: true };
  });

const txInput = z.object({
  description: z.string().min(1),
  amount: z.number(),
  currency: z.string(),
  type: z.string(),
  category: z.string().optional().nullable(),
  date: z.string(),
  assetId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
});

export const addTransaction = createServerFn({ method: "POST" })
  .validator(txInput)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql.query(
      `insert into transactions (id, date, description, amount, currency, type, category, asset_id, account_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        data.date,
        data.description.trim(),
        data.amount,
        data.currency,
        data.type,
        data.category || null,
        data.assetId || null,
        data.accountId || null,
      ],
    );
    return { id };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from transactions where id = ${data.id}`;
    return { ok: true };
  });

export const updateFx = createServerFn({ method: "POST" })
  .validator(
    z.object({
      official: z.number(),
      blue: z.number(),
      mep: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(
      `update fx_rates set official = $1, blue = $2, mep = $3, updated_at = now() where id = 1`,
      [data.official, data.blue, data.mep],
    );
    await writeTodaySnapshot();
    return { ok: true };
  });
