import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { netWorthUsd } from "@/lib/portfolio-math";
import { fetchCryptoUsd, fetchStockUsd } from "@/lib/prices";
import type {
  Account,
  AllocTarget,
  AppSettings,
  Asset,
  Fx,
  FxHistoryRow,
  Goal,
  Liability,
  Portfolio,
  RecurringIncome,
  Snapshot,
  Tx,
} from "@/lib/types";
import { num } from "@/lib/utils";

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
    accountId: r.account_id == null ? null : String(r.account_id),
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

function mapLiability(r: Record<string, unknown>): Liability {
  return {
    id: String(r.id),
    name: String(r.name),
    type: String(r.type),
    balance: num(r.balance),
    currency: String(r.currency),
    interestRate: r.interest_rate == null ? null : num(r.interest_rate),
    linkedAssetId: r.linked_asset_id == null ? null : String(r.linked_asset_id),
    notes: r.notes == null ? null : String(r.notes),
  };
}

function mapGoal(r: Record<string, unknown>): Goal {
  return {
    id: String(r.id),
    name: String(r.name),
    targetUsd: num(r.target_usd),
    targetDate: r.target_date == null ? null : String(r.target_date).slice(0, 10),
    notes: r.notes == null ? null : String(r.notes),
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

async function safeQuery(run: () => Promise<Record<string, unknown>[]>) {
  try {
    return await run();
  } catch {
    return [] as Record<string, unknown>[];
  }
}

function stepFrequency(iso: string, frequency: string): string {
  const d = new Date(iso + "T12:00:00Z");
  switch (frequency) {
    case "WEEKLY":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "MONTHLY":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "QUARTERLY":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case "SEMI_ANNUAL":
      d.setUTCMonth(d.getUTCMonth() + 6);
      break;
    case "ANNUAL":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    default:
      d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

async function applyDueRecurringInner() {
  const sql = await getSql();
  const today = new Date().toISOString().slice(0, 10);
  const due = await sql`
    select * from recurring_incomes
    where next_date <= ${today}
    order by next_date asc
  `;
  let applied = 0;
  for (const row of due) {
    const rec = mapRec(row);
    let cursor = rec.nextDate;
    let guard = 0;
    while (cursor <= today && guard < 36) {
      const txId = crypto.randomUUID();
      await sql.query(
        `insert into transactions (id, date, description, amount, currency, type, category, asset_id, account_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          txId,
          cursor,
          rec.name,
          rec.amount,
          rec.currency,
          "INCOME",
          rec.frequency,
          rec.assetId,
          rec.accountId,
        ],
      );
      if (rec.accountId) {
        await sql.query(
          `update accounts set balance = balance + $1, updated_at = now() where id = $2`,
          [rec.amount, rec.accountId],
        );
      }
      cursor = stepFrequency(cursor, rec.frequency);
      guard += 1;
      applied += 1;
    }
    await sql.query(`update recurring_incomes set next_date = $1 where id = $2`, [
      cursor,
      rec.id,
    ]);
  }
  return applied;
}

async function loadPortfolioInner(): Promise<Portfolio> {
  const sql = await getSql();
  try {
    await applyDueRecurringInner();
  } catch {
    // schema may not have account_id yet; still load
  }

  const [assetRows, accRows, recRows, txRows, snapRows, fx] = await Promise.all([
    sql`select * from assets order by current_value desc`,
    sql`select * from accounts order by name`,
    sql`select * from recurring_incomes order by next_date`,
    sql`select * from transactions order by date desc, created_at desc limit 80`,
    sql`select date, total_usd from snapshots order by date asc`,
    loadFx(),
  ]);

  const liabilityRows = await safeQuery(
    () => sql`select * from liabilities order by balance desc`,
  );
  const goalRows = await safeQuery(() => sql`select * from goals order by name`);
  const allocRows = await safeQuery(
    () => sql`select asset_type, target_pct from alloc_targets`,
  );
  const fxHistRows = await safeQuery(
    () => sql`select date, official, blue, mep from fx_history order by date desc limit 90`,
  );
  const settingsRows = await safeQuery(
    () => sql`select pin_hash is not null as has_pin, pin_enabled from app_settings where id = 1`,
  );

  const settings: AppSettings = {
    pinEnabled: Boolean(settingsRows[0]?.pin_enabled),
    hasPin: Boolean(settingsRows[0]?.has_pin),
  };

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
    liabilities: liabilityRows.map(mapLiability),
    goals: goalRows.map(mapGoal),
    allocTargets: allocRows.map(
      (r): AllocTarget => ({
        assetType: String(r.asset_type),
        targetPct: num(r.target_pct),
      }),
    ),
    fxHistory: fxHistRows.map(
      (r): FxHistoryRow => {
        const official = num(r.official);
        const blue = num(r.blue);
        const mep = num(r.mep);
        return {
          date: String(r.date).slice(0, 10),
          official,
          blue,
          mep,
          average: (official + blue + mep) / 3,
        };
      },
    ),
    settings,
  };
}

async function writeTodaySnapshot() {
  const sql = await getSql();
  const portfolio = await loadPortfolioInner();
  const liabilityUsd = portfolio.liabilities.reduce(
    (s, l) => s + (l.currency === "ARS" ? l.balance / portfolio.fx.average : l.balance),
    0,
  );
  const total = netWorthUsd(portfolio) - liabilityUsd;
  const today = new Date().toISOString().slice(0, 10);
  await sql.query(
    `insert into snapshots (date, total_usd) values ($1, $2)
     on conflict (date) do update set total_usd = excluded.total_usd`,
    [today, total],
  );
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
    const rec =
      await sql`select * from recurring_incomes where asset_id = ${data.id} order by next_date`;
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
  assetId: z.string().min(1),
  accountId: z.string().optional().nullable(),
  name: z.string().min(1),
  amount: z.number(),
  currency: z.string(),
  frequency: z.string(),
  nextDate: z.string(),
  notes: z.string().optional().nullable(),
});

export const upsertRecurring = createServerFn({ method: "POST" })
  .validator(recInput)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id || crypto.randomUUID();
    await sql.query(
      `insert into recurring_incomes (id, asset_id, account_id, name, amount, currency, frequency, next_date, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (id) do update set
         asset_id = excluded.asset_id,
         account_id = excluded.account_id,
         name = excluded.name,
         amount = excluded.amount,
         currency = excluded.currency,
         frequency = excluded.frequency,
         next_date = excluded.next_date,
         notes = excluded.notes`,
      [
        id,
        data.assetId,
        data.accountId || null,
        data.name.trim(),
        data.amount,
        data.currency,
        data.frequency,
        data.nextDate,
        data.notes || null,
      ],
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
    try {
      const today = new Date().toISOString().slice(0, 10);
      await sql.query(
        `insert into fx_history (date, official, blue, mep)
         values ($1,$2,$3,$4)
         on conflict (date) do update set
           official = excluded.official,
           blue = excluded.blue,
           mep = excluded.mep`,
        [today, data.official, data.blue, data.mep],
      );
    } catch {
      // fx_history optional
    }
    await writeTodaySnapshot();
    return { ok: true };
  });

export const refreshPrices = createServerFn({ method: "POST" }).handler(async () => {
  const sql = await getSql();
  const assets = await sql`select id, ticker, type, quantity, current_value from assets`;
  const cryptoTickers = assets
    .filter((a) => String(a.type) === "CRYPTO" && a.ticker)
    .map((a) => String(a.ticker).toUpperCase());
  const stockTickers = assets
    .filter((a) => String(a.type) === "STOCK" && a.ticker)
    .map((a) => String(a.ticker).toUpperCase());

  const [crypto, stocks] = await Promise.all([
    fetchCryptoUsd(cryptoTickers),
    fetchStockUsd(stockTickers),
  ]);

  let updated = 0;
  for (const a of assets) {
    const ticker = a.ticker ? String(a.ticker).toUpperCase() : null;
    if (!ticker) continue;
    const qty = a.quantity == null ? null : num(a.quantity);
    let unit: number | undefined;
    if (String(a.type) === "CRYPTO") unit = crypto[ticker];
    if (String(a.type) === "STOCK") unit = stocks[ticker];
    if (unit == null || unit <= 0) continue;
    const value = qty != null && qty > 0 ? unit * qty : unit;
    await sql.query(
      `update assets set current_value = $1, updated_at = now() where id = $2`,
      [value, a.id],
    );
    updated += 1;
  }
  if (updated > 0) await writeTodaySnapshot();
  return { updated, crypto: Object.keys(crypto).length, stocks: Object.keys(stocks).length };
});

export const snapshotNow = createServerFn({ method: "POST" }).handler(async () => {
  await writeTodaySnapshot();
  return { ok: true };
});

/** Set or clear the app password. Pass null/empty to disable. */
export const setPin = createServerFn({ method: "POST" })
  .validator(
    z.object({
      pin: z.string().min(4).max(32).nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    // ensure row exists
    await sql.query(
      `insert into app_settings (id, pin_enabled) values (1, false)
       on conflict (id) do nothing`,
    );
    if (!data.pin) {
      await sql.query(
        `update app_settings set pin_hash = null, pin_enabled = false, updated_at = now() where id = 1`,
      );
      return { ok: true, enabled: false };
    }
    const hash = await sha256(data.pin);
    await sql.query(
      `update app_settings set pin_hash = $1, pin_enabled = true, updated_at = now() where id = 1`,
      [hash],
    );
    return { ok: true, enabled: true };
  });

/** Verify the password entered on the lock screen. */
export const verifyPin = createServerFn({ method: "POST" })
  .validator(z.object({ pin: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await safeQuery(
      () => sql`select pin_hash, pin_enabled from app_settings where id = 1`,
    );
    const row = rows[0];
    if (!row?.pin_enabled || !row.pin_hash) return { ok: true };
    const hash = await sha256(data.pin);
    return { ok: hash === String(row.pin_hash) };
  });
