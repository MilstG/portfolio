import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";
import { netWorthUsd } from "@/lib/portfolio-math";
import { ASSET_TYPES, CURRENCIES, FREQUENCIES, TX_TYPES } from "@/lib/utils";
import {
  fetchArgBondFactors,
  fetchCedearUsd,
  fetchCryptoUsd,
  fetchDolarRates,
  fetchStockUsd,
} from "@/lib/prices";
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
  TaxLot,
  Tx,
  WatchItem,
} from "@/lib/types";
export {
  upsertLiability,
  deleteLiability,
  importTransactionsCsv,
  upsertTaxLot,
  deleteTaxLot,
  upsertWatchItem,
  deleteWatchItem,
  refreshWatchlistPrices,
} from "@/lib/server/extra-actions";
import { num } from "@/lib/utils";

/** Types that are supposed to get a quote from an upstream feed. */
const PRICED_TYPES = new Set(["CRYPTO", "STOCK", "BOND", "CEDEAR"]);

function mapAsset(r: Record<string, unknown>): Asset {
  const type = String(r.type);
  const costBasis = num(r.cost_basis);
  const stored = num(r.current_value);

  // A quote we could not fetch is not a value of zero. Zero would flow into net
  // worth, allocation, weights, concentration and P&L as if the position had
  // become worthless, silently understating the book; cost basis is the honest
  // stand-in until a real price arrives.
  const unpriced = PRICED_TYPES.has(type) && stored <= 0 && costBasis > 0;

  return {
    id: String(r.id),
    name: String(r.name),
    ticker: r.ticker == null ? null : String(r.ticker),
    type,
    quantity: r.quantity == null ? null : num(r.quantity),
    costBasis,
    currentValue: unpriced ? costBasis : stored,
    currency: String(r.currency),
    purchaseDate:
      r.purchase_date == null ? null : String(r.purchase_date).slice(0, 10),
    notes: r.notes == null ? null : String(r.notes),
    unpriced,
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
  const dir = String(r.direction || "INCOME").toUpperCase();
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
    direction: dir === "EXPENSE" ? "EXPENSE" : "INCOME",
  };
}

function mapTaxLot(r: Record<string, unknown>): TaxLot {
  return {
    id: String(r.id),
    assetId: String(r.asset_id),
    quantity: num(r.quantity),
    costPerUnit: num(r.cost_per_unit),
    currency: String(r.currency),
    purchasedAt: String(r.purchased_at).slice(0, 10),
    notes: r.notes == null ? null : String(r.notes),
  };
}

function mapWatch(r: Record<string, unknown>): WatchItem {
  return {
    id: String(r.id),
    ticker: String(r.ticker),
    name: r.name == null ? null : String(r.name),
    type: String(r.type),
    lastPrice: r.last_price == null ? null : num(r.last_price),
    currency: String(r.currency || "USD"),
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
    targetDate:
      r.target_date == null ? null : String(r.target_date).slice(0, 10),
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
      const signed =
        rec.direction === "EXPENSE"
          ? -Math.abs(rec.amount)
          : Math.abs(rec.amount);
      const txType = rec.direction === "EXPENSE" ? "EXPENSE" : "INCOME";
      await sql.query(
        `insert into transactions (id, date, description, amount, currency, type, category, asset_id, account_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          txId,
          cursor,
          rec.name,
          signed,
          rec.currency,
          txType,
          rec.frequency,
          rec.assetId,
          rec.accountId,
        ],
      );
      if (rec.accountId) {
        await sql.query(
          `update accounts set balance = balance + $1, updated_at = now() where id = $2`,
          [signed, rec.accountId],
        );
      }
      cursor = stepFrequency(cursor, rec.frequency);
      guard += 1;
      applied += 1;
    }
    await sql.query(
      `update recurring_incomes set next_date = $1 where id = $2`,
      [cursor, rec.id],
    );
  }
  return applied;
}

async function loadPortfolioInner(): Promise<Portfolio> {
  const sql = await getSql();
  await applyDueRecurringInner();

  const [
    assetRows,
    accRows,
    recRows,
    txRows,
    snapRows,
    fx,
    liabilityRows,
    goalRows,
    allocRows,
    fxHistRows,
    settingsRows,
    taxLotRows,
    watchRows,
  ] = await Promise.all([
    sql`select * from assets order by current_value desc`,
    sql`select * from accounts order by name`,
    sql`select * from recurring_incomes order by next_date`,
    sql`select * from transactions order by date desc, created_at desc limit 500`,
    sql`select date, total_usd from snapshots order by date asc`,
    loadFx(),
    sql`select * from liabilities order by balance desc`,
    sql`select * from goals order by name`,
    sql`select asset_type, target_pct from alloc_targets`,
    sql`select date, official, blue, mep from fx_history order by date desc limit 90`,
    sql`select pin_hash is not null as has_pin, pin_enabled from app_settings where id = 1`,
    sql`select * from tax_lots order by purchased_at desc`,
    sql`select * from watchlist order by ticker`,
  ]);

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
    allocTargets: allocRows.map((r): AllocTarget => ({
      assetType: String(r.asset_type),
      targetPct: num(r.target_pct),
    })),
    fxHistory: fxHistRows.map((r): FxHistoryRow => {
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
    }),
    settings,
    taxLots: taxLotRows.map(mapTaxLot),
    watchlist: watchRows.map(mapWatch),
    lastPriceRun: await lastPriceRun(),
  };
}

/**
 * Recompute today's net worth from the four tables that feed it (not the whole
 * portfolio) and upsert the daily snapshot. netWorthUsd already subtracts
 * liabilities — do not subtract twice.
 */
async function writeTodaySnapshot() {
  const sql = await getSql();
  const [assetRows, accRows, liabilityRows, fx] = await Promise.all([
    sql`select current_value, currency from assets`,
    sql`select balance, currency from accounts`,
    sql`select balance, currency from liabilities`,
    loadFx(),
  ]);
  const total = netWorthUsd({
    assets: assetRows.map((r) => ({
      currentValue: num(r.current_value),
      currency: String(r.currency),
    })),
    accounts: accRows.map((r) => ({
      balance: num(r.balance),
      currency: String(r.currency),
    })),
    liabilities: liabilityRows.map((r) => ({
      balance: num(r.balance),
      currency: String(r.currency),
    })),
    fx,
  });
  const today = new Date().toISOString().slice(0, 10);
  await sql.query(
    `insert into snapshots (date, total_usd) values ($1, $2)
     on conflict (date) do update set total_usd = excluded.total_usd`,
    [today, total],
  );
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");
// `.pipe` keeps the client-side input type as plain string while the server
// still rejects anything outside the known set.
const currency = z.string().trim().toUpperCase().pipe(z.enum(CURRENCIES));
const assetType = z.enum(
  ASSET_TYPES.map((t) => t.value) as [string, ...string[]],
);
const frequency = z.enum(
  FREQUENCIES.map((f) => f.value) as [string, ...string[]],
);
const txType = z.enum(TX_TYPES.map((t) => t.value) as [string, ...string[]]);
const shortText = z.string().trim().max(200);
const longText = z.string().max(2000);
const money = z.number().finite();

/**
 * Kick off a refresh when prices have gone stale, without making the caller
 * wait for it.
 *
 * The marker is written *before* the work starts, so several tabs loading at
 * once queue one refresh rather than a stampede of outbound calls. The current
 * response still serves the prices it already had; the next one sees fresh
 * ones.
 */
async function maybeRefreshPricesInBackground(): Promise<void> {
  const minutes = refreshIntervalMinutes();
  if (minutes === 0) return;
  const last = await lastPriceAttempt();
  if (last) {
    const age = Date.now() - Date.parse(last);
    if (Number.isFinite(age) && age < minutes * 60_000) return;
  }
  await markPriceRun();
  void runPriceRefresh().catch((err) => {
    console.error("[prices] refresh automático falló:", err);
  });
}

export const getPortfolio = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const portfolio = await loadPortfolioInner();
    // Deliberately not awaited: a slow upstream must not delay the dashboard.
    void maybeRefreshPricesInBackground();
    return portfolio;
  });

export const getAsset = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql`select * from assets where id = ${data.id}`;
    if (!rows[0]) return null;
    const [rec, lots] = await Promise.all([
      sql`select * from recurring_incomes where asset_id = ${data.id} order by next_date`,
      sql`select * from tax_lots where asset_id = ${data.id} order by purchased_at`,
    ]);
    return {
      asset: mapAsset(rows[0]),
      recurring: rec.map(mapRec),
      taxLots: lots.map(mapTaxLot),
    };
  });

const assetInput = z.object({
  id: z.string().max(64).optional(),
  name: shortText.min(1),
  ticker: z.string().trim().max(24).optional().nullable(),
  type: assetType,
  quantity: money.nullable().optional(),
  costBasis: money,
  currentValue: money,
  currency,
  purchaseDate: isoDate.optional().nullable().or(z.literal("")),
  notes: longText.optional().nullable(),
});

export const upsertAsset = createServerFn({ method: "POST" })
  .middleware([requireAuth])
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
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from assets where id = ${data.id}`;
    await writeTodaySnapshot();
    return { ok: true };
  });

const accountInput = z.object({
  id: z.string().max(64).optional(),
  name: shortText.min(1),
  institution: shortText.optional().nullable(),
  type: z
    .string()
    .pipe(z.enum(["bank", "broker", "exchange", "wallet", "physical"])),
  currency,
  balance: money,
  notes: longText.optional().nullable(),
});

export const upsertAccount = createServerFn({ method: "POST" })
  .middleware([requireAuth])
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
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from accounts where id = ${data.id}`;
    await writeTodaySnapshot();
    return { ok: true };
  });

const recInput = z.object({
  id: z.string().max(64).optional(),
  assetId: z.string().min(1).max(64),
  accountId: z.string().max(64).optional().nullable(),
  name: shortText.min(1),
  amount: money,
  currency,
  frequency,
  nextDate: isoDate,
  notes: longText.optional().nullable(),
  direction: z.enum(["INCOME", "EXPENSE"]).optional(),
});

export const upsertRecurring = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(recInput)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id || crypto.randomUUID();
    const direction = data.direction === "EXPENSE" ? "EXPENSE" : "INCOME";
    await sql.query(
      `insert into recurring_incomes (id, asset_id, account_id, name, amount, currency, frequency, next_date, notes, direction)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set
         asset_id = excluded.asset_id,
         account_id = excluded.account_id,
         name = excluded.name,
         amount = excluded.amount,
         currency = excluded.currency,
         frequency = excluded.frequency,
         next_date = excluded.next_date,
         notes = excluded.notes,
         direction = excluded.direction`,
      [
        id,
        data.assetId,
        data.accountId || null,
        data.name.trim(),
        Math.abs(data.amount),
        data.currency,
        data.frequency,
        data.nextDate,
        data.notes || null,
        direction,
      ],
    );
    return { id };
  });

export const deleteRecurring = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from recurring_incomes where id = ${data.id}`;
    return { ok: true };
  });

const txInput = z.object({
  description: shortText.min(1),
  amount: money,
  currency,
  type: txType,
  category: shortText.optional().nullable(),
  date: isoDate,
  assetId: z.string().max(64).optional().nullable(),
  accountId: z.string().max(64).optional().nullable(),
});

export const addTransaction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
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
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from transactions where id = ${data.id}`;
    return { ok: true };
  });

export const updateFx = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      official: z.number().positive(),
      blue: z.number().positive(),
      mep: z.number().positive(),
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
      // `average` is NOT NULL with no default. Omitting it made every one of
      // these inserts throw, and the empty catch below swallowed it — so
      // fx_history never recorded a single row, and anything reading it (the
      // FX chart, NW vs DÓLAR) was permanently empty.
      const average = (data.official + data.blue + data.mep) / 3;
      await sql.query(
        `insert into fx_history (date, official, blue, mep, average)
         values ($1,$2,$3,$4,$5)
         on conflict (date) do update set
           official = excluded.official,
           blue = excluded.blue,
           mep = excluded.mep,
           average = excluded.average`,
        [today, data.official, data.blue, data.mep, average],
      );
    } catch (err) {
      // Still non-fatal — updating the rate matters more than recording it —
      // but no longer invisible.
      console.error("[fx] no se pudo escribir fx_history:", err);
    }
    await writeTodaySnapshot();
    return { ok: true };
  });

/* ------------------------------------------------------------ price refresh */

/**
 * Two markers, deliberately.
 *
 * The attempt throttles the automatic trigger, so a source that is down does
 * not get hammered on every page load. The success is what the footer reports —
 * marking a run that fetched nothing would show "LIVE · RECIÉN" over prices
 * that never arrived.
 */
const PRICE_RUN_KEY = "last_price_run";
const PRICE_OK_KEY = "last_price_success";

/** Minutes between automatic refreshes. 0 disables it. */
function refreshIntervalMinutes(): number {
  const raw = Number(process.env.PRICE_REFRESH_MINUTES ?? 60);
  return Number.isFinite(raw) && raw >= 0 ? raw : 60;
}

async function markMeta(key: string): Promise<void> {
  try {
    const sql = await getSql();
    await sql.query(
      `insert into app_meta (key, value, updated_at)
       values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [key, new Date().toISOString()],
    );
  } catch (err) {
    console.error("[prices] no se pudo marcar la corrida:", err);
  }
}

const markPriceRun = () => markMeta(PRICE_RUN_KEY);
const markPriceSuccess = () => markMeta(PRICE_OK_KEY);

async function readMeta(key: string): Promise<string | null> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ value: string }>(
      `select value from app_meta where key = $1`,
      [key],
    );
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

/** Last attempt — throttles the automatic trigger. */
export const lastPriceAttempt = () => readMeta(PRICE_RUN_KEY);
/** Last run that actually brought data back — what the footer shows. */
export const lastPriceRun = () => readMeta(PRICE_OK_KEY);

/**
 * The refresh itself, callable without going through the server function.
 *
 * The automatic trigger runs it in the background from the portfolio loader,
 * where there is no request to authorise — the manual action keeps the auth
 * middleware.
 */
/** Stored MEP, for when the FX feed is unreachable but CEDEARs still need one. */
async function currentMep(sql: Awaited<ReturnType<typeof getSql>>) {
  try {
    const rows = await sql.query<{ mep: unknown }>(
      `select mep from fx_rates where id = 1`,
    );
    const mep = rows[0]?.mep == null ? 0 : num(rows[0].mep);
    return mep > 0 ? mep : 0;
  } catch {
    return 0;
  }
}

export async function runPriceRefresh() {
  const sql = await getSql();
  const assets =
    await sql`select id, ticker, type, quantity, current_value from assets`;
  const cryptoTickers = assets
    .filter((a) => String(a.type) === "CRYPTO" && a.ticker)
    .map((a) => String(a.ticker).toUpperCase());
  const stockTickers = assets
    .filter((a) => String(a.type) === "STOCK" && a.ticker)
    .map((a) => String(a.ticker).toUpperCase());
  const bondTickers = assets
    .filter((a) => String(a.type) === "BOND" && a.ticker)
    .map((a) => String(a.ticker).toUpperCase());
  const cedearTickers = assets
    .filter((a) => String(a.type) === "CEDEAR" && a.ticker)
    .map((a) => String(a.ticker).toUpperCase());

  // FX first: CEDEARs quote in pesos, so their USD price depends on MEP.
  const fx = await fetchDolarRates();
  const mepRate = fx?.mep ?? (await currentMep(sql));

  const [crypto, stocks, bondFactors, cedears] = await Promise.all([
    fetchCryptoUsd(cryptoTickers),
    fetchStockUsd(stockTickers),
    fetchArgBondFactors(bondTickers),
    fetchCedearUsd(cedearTickers, mepRate),
  ]);

  const ids: string[] = [];
  const values: number[] = [];
  /** Priced assets that need a quote but did not get one, by name. */
  const unpriced: string[] = [];

  for (const a of assets) {
    const type = String(a.type);
    const tracked =
      type === "CRYPTO" ||
      type === "STOCK" ||
      type === "BOND" ||
      type === "CEDEAR";
    if (!tracked) continue;

    const ticker = a.ticker ? String(a.ticker).toUpperCase() : null;
    const label = String(a.name ?? a.ticker ?? a.id);
    if (!ticker) {
      unpriced.push(`${label} (sin ticker)`);
      continue;
    }
    const qty = a.quantity == null ? null : num(a.quantity);

    let value: number | null = null;
    if (type === "BOND") {
      // Bond quotes are a factor of face value, so the position is worth
      // nominal x factor. Without a nominal there is nothing to scale.
      const factor = bondFactors[ticker];
      if (factor != null && qty != null && qty > 0) value = qty * factor;
    } else {
      const unit =
        type === "CRYPTO"
          ? crypto[ticker]
          : type === "CEDEAR"
            ? cedears[ticker]
            : stocks[ticker];
      if (unit != null && unit > 0) {
        value = qty != null && qty > 0 ? unit * qty : unit;
      }
    }

    if (value == null) {
      unpriced.push(`${label} (${ticker})`);
      continue;
    }
    ids.push(String(a.id));
    values.push(value);
  }
  const updated = ids.length;
  if (updated > 0) {
    await sql.query(
      `update assets a set current_value = v.value, price_status = 'LIVE', updated_at = now()
       from unnest($1::text[], $2::numeric[]) as v(id, value)
      where a.id = v.id`,
      [ids, values],
    );
  }
  // FX moves the value of every ARS-denominated holding, so it is refreshed
  // in the same pass and recorded for the history series.
  if (fx) {
    const average = (fx.official + fx.blue + fx.mep) / 3;
    await sql.query(
      `update fx_rates set official = $1, blue = $2, mep = $3, updated_at = now() where id = 1`,
      [fx.official, fx.blue, fx.mep],
    );
    try {
      await sql.query(
        `insert into fx_history (date, official, blue, mep, average)
         values ($1,$2,$3,$4,$5)
         on conflict (date) do update set
           official = excluded.official,
           blue = excluded.blue,
           mep = excluded.mep,
           average = excluded.average`,
        [
          new Date().toISOString().slice(0, 10),
          fx.official,
          fx.blue,
          fx.mep,
          average,
        ],
      );
    } catch (err) {
      console.error("[fx] no se pudo escribir fx_history:", err);
    }
  }

  await markPriceRun();
  if (updated > 0 || fx) await writeTodaySnapshot();
  // Counts per source so a silent outage is visible instead of looking like
  // "nothing changed".
  return {
    updated,
    crypto: Object.keys(crypto).length,
    cryptoWanted: new Set(cryptoTickers).size,
    stocks: Object.keys(stocks).length,
    stocksWanted: new Set(stockTickers).size,
    bonds: Object.keys(bondFactors).length,
    bondsWanted: new Set(bondTickers).size,
    cedears: Object.keys(cedears).length,
    cedearsWanted: new Set(cedearTickers).size,
    fx: fx != null,
    // Named, not just counted: an asset silently stuck at zero is the whole
    // failure mode this exists to surface.
    unpriced,
  };
}

/** Just the freshness marker, for the shell footer. */
export const getPriceStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => ({ lastPriceRun: await lastPriceRun() }));

export const refreshPrices = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => runPriceRefresh());

export const snapshotNow = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => {
    await writeTodaySnapshot();
    return { ok: true };
  });

const goalInput = z.object({
  id: z.string().max(64).optional(),
  name: shortText.min(1),
  targetUsd: z.number().positive().finite(),
  targetDate: isoDate.optional().nullable().or(z.literal("")),
  notes: longText.optional().nullable(),
});

export const upsertGoal = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(goalInput)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id || crypto.randomUUID();
    await sql.query(
      `insert into goals (id, name, target_usd, target_date, notes)
       values ($1,$2,$3,$4,$5)
       on conflict (id) do update set
         name = excluded.name,
         target_usd = excluded.target_usd,
         target_date = excluded.target_date,
         notes = excluded.notes`,
      [
        id,
        data.name.trim(),
        data.targetUsd,
        data.targetDate || null,
        data.notes || null,
      ],
    );
    return { id };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from goals where id = ${data.id}`;
    return { ok: true };
  });

const allocTargetsInput = z.object({
  targets: z
    .array(
      z.object({
        assetType: z.string().min(1).max(32),
        targetPct: z.number().min(0).max(100),
      }),
    )
    .max(20),
});

/** Replace every allocation target in one round-trip. */
export const setAllocTargets = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(allocTargetsInput)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into alloc_targets (asset_type, target_pct)
       select * from unnest($1::text[], $2::numeric[])
       on conflict (asset_type) do update set target_pct = excluded.target_pct`,
      [
        data.targets.map((t) => t.assetType),
        data.targets.map((t) => t.targetPct),
      ],
    );
    return { ok: true };
  });
