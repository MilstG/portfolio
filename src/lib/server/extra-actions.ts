import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";
import { fetchCryptoUsd, fetchStockUsd } from "@/lib/prices";

export const upsertLiability = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      type: z.string().default("loan"),
      balance: z.number().min(0),
      currency: z.string().default("USD"),
      interestRate: z.number().optional().nullable(),
      linkedAssetId: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id || crypto.randomUUID();
    await sql.query(
      `insert into liabilities (id, name, type, balance, currency, interest_rate, linked_asset_id, notes, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8, now())
       on conflict (id) do update set
         name = excluded.name,
         type = excluded.type,
         balance = excluded.balance,
         currency = excluded.currency,
         interest_rate = excluded.interest_rate,
         linked_asset_id = excluded.linked_asset_id,
         notes = excluded.notes,
         updated_at = now()`,
      [
        id,
        data.name.trim(),
        data.type || "loan",
        data.balance,
        data.currency || "USD",
        data.interestRate ?? null,
        data.linkedAssetId || null,
        data.notes || null,
      ],
    );
    return { id };
  });

export const deleteLiability = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from liabilities where id = ${data.id}`;
    return { ok: true };
  });

export const importTransactionsCsv = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      rows: z
        .array(
          z.object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
            description: z.string().trim().min(1).max(200),
            amount: z.number().finite(),
            currency: z.string().max(8).default("USD"),
            type: z.string().max(16).default("INCOME"),
            category: z.string().max(64).optional().nullable(),
          }),
        )
        .max(5000),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = data.rows.filter((r) => r.date && r.description);
    if (rows.length === 0) return { inserted: 0 };
    // One statement for the whole file instead of one round-trip per row.
    await sql.query(
      `insert into transactions (id, date, description, amount, currency, type, category)
       select * from unnest($1::text[], $2::date[], $3::text[], $4::numeric[], $5::text[], $6::text[], $7::text[])`,
      [
        rows.map(() => crypto.randomUUID()),
        rows.map((r) => r.date.slice(0, 10)),
        rows.map((r) => r.description.trim()),
        rows.map((r) => r.amount),
        rows.map((r) => (r.currency || "USD").toUpperCase()),
        rows.map((r) => (r.type || "INCOME").toUpperCase()),
        rows.map((r) => r.category || null),
      ],
    );
    return { inserted: rows.length };
  });

/**
 * Bulk-load historical net-worth points.
 *
 * Snapshots only ever accrued forward from the day the app started running, so
 * NW SERIES, DRAWDOWN and any benchmark had nothing to plot. This lets a real
 * history be pasted in once.
 */
export const backfillSnapshots = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      rows: z
        .array(
          z.object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
            totalUsd: z.number().finite().nonnegative(),
          }),
        )
        .max(5000),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    // Later rows win on a duplicate date, matching the on-conflict below.
    const byDate = new Map<string, number>();
    for (const r of data.rows) byDate.set(r.date.slice(0, 10), r.totalUsd);
    const rows = [...byDate.entries()];
    if (rows.length === 0) return { written: 0 };
    await sql.query(
      `insert into snapshots (date, total_usd)
       select * from unnest($1::date[], $2::numeric[])
       on conflict (date) do update set total_usd = excluded.total_usd`,
      [rows.map((r) => r[0]), rows.map((r) => r[1])],
    );
    return { written: rows.length };
  });

export const deleteSnapshot = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}/) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(`delete from snapshots where date = $1`, [
      data.date.slice(0, 10),
    ]);
    return { ok: true };
  });

/**
 * Bulk-load a bond payment schedule, linked to the bonds it belongs to.
 *
 * The generic CSV importer never set asset_id, so rows imported through it were
 * orphaned: the projections and every bond metric filter by asset, and an
 * unlinked payment is invisible to all of them. This resolves each row by
 * ticker instead.
 *
 * Ids are derived from ticker + date + leg, so re-importing a corrected file
 * updates the same rows rather than duplicating the schedule.
 */
/**
 * Bulk-load historical FX.
 *
 * Companion to backfillSnapshots: NW vs DÓLAR needs both series to overlap, and
 * fx_history only ever grows one row per day going forward.
 */
export const backfillFxHistory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      rows: z
        .array(
          z.object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
            official: z.number().finite().positive(),
            blue: z.number().finite().positive(),
            mep: z.number().finite().positive(),
          }),
        )
        .max(5000),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    // Later rows win on a duplicate date, matching the on-conflict below.
    const byDate = new Map<
      string,
      { official: number; blue: number; mep: number }
    >();
    for (const r of data.rows) {
      byDate.set(r.date.slice(0, 10), {
        official: r.official,
        blue: r.blue,
        mep: r.mep,
      });
    }
    const rows = [...byDate.entries()];
    if (rows.length === 0) return { written: 0 };

    await sql.query(
      `insert into fx_history (date, official, blue, mep, average)
       select * from unnest($1::date[], $2::numeric[], $3::numeric[], $4::numeric[], $5::numeric[])
       on conflict (date) do update set
         official = excluded.official,
         blue = excluded.blue,
         mep = excluded.mep,
         average = excluded.average`,
      [
        rows.map((r) => r[0]),
        rows.map((r) => r[1].official),
        rows.map((r) => r[1].blue),
        rows.map((r) => r[1].mep),
        rows.map((r) => (r[1].official + r[1].blue + r[1].mep) / 3),
      ],
    );
    return { written: rows.length };
  });

export const importBondSchedule = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      rows: z
        .array(
          z.object({
            ticker: z.string().trim().min(1).max(32),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
            coupon: z.number().finite().nonnegative().default(0),
            amort: z.number().finite().nonnegative().default(0),
          }),
        )
        .max(5000),
      /** Clear the existing schedule of the matched bonds before inserting. */
      replace: z.boolean().default(false),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const bondRows = await sql.query<{ id: string; ticker: string | null }>(
      `select id, ticker from assets where type = 'BOND' and ticker is not null`,
    );
    const byTicker = new Map<string, string>();
    for (const b of bondRows) {
      if (b.ticker) byTicker.set(b.ticker.trim().toUpperCase(), b.id);
    }

    const unknown = new Set<string>();
    const matched = new Set<string>();
    const ids: string[] = [];
    const dates: string[] = [];
    const descs: string[] = [];
    const amounts: number[] = [];
    const types: string[] = [];
    const assetIds: string[] = [];

    for (const r of data.rows) {
      const ticker = r.ticker.trim().toUpperCase();
      const assetId = byTicker.get(ticker);
      if (!assetId) {
        unknown.add(ticker);
        continue;
      }
      matched.add(assetId);
      const date = r.date.slice(0, 10);
      const slug = ticker.toLowerCase();
      // A single dated row can carry both legs; they are stored separately so
      // current yield can exclude principal.
      if (r.coupon > 0) {
        ids.push(`pay-${slug}-${date}-renta`);
        dates.push(date);
        descs.push(`Cupón ${ticker}`);
        amounts.push(r.coupon);
        types.push("COUPON");
        assetIds.push(assetId);
      }
      if (r.amort > 0) {
        ids.push(`pay-${slug}-${date}-amort`);
        dates.push(date);
        descs.push(`Amortización ${ticker}`);
        amounts.push(r.amort);
        types.push("AMORT");
        assetIds.push(assetId);
      }
    }

    if (ids.length === 0) {
      return {
        inserted: 0,
        coupons: 0,
        amorts: 0,
        replaced: 0,
        unknown: [...unknown],
      };
    }

    // Insert first, prune second. The other order deletes the schedule and
    // then leaves nothing behind if the insert fails, which is exactly what a
    // botched import must not do.
    //
    // Columns are named explicitly: `select *, 'USD', 'Bonds'` appends the
    // constants after the unnest columns rather than dropping them into the
    // currency and category slots, so asset_id ended up as 'Bonds' and tripped
    // the foreign key.
    await sql.query(
      `insert into transactions (id, date, description, amount, currency, type, category, asset_id)
       select t.id, t.date, t.description, t.amount, 'USD', t.type, 'Bonds', t.asset_id
       from unnest($1::text[], $2::date[], $3::text[], $4::numeric[], $5::text[], $6::text[])
         as t(id, date, description, amount, type, asset_id)
       on conflict (id) do update set
         date = excluded.date,
         description = excluded.description,
         amount = excluded.amount,
         type = excluded.type,
         asset_id = excluded.asset_id`,
      [ids, dates, descs, amounts, types, assetIds],
    );

    let replaced = 0;
    if (data.replace) {
      // `returning` because the shared Sql surface resolves to rows, not a
      // driver result object with rowCount.
      const removed = await sql.query<{ id: string }>(
        `delete from transactions
         where asset_id = any($1::text[]) and id <> all($2::text[])
         returning id`,
        [[...matched], ids],
      );
      replaced = removed.length;
    }

    return {
      inserted: ids.length,
      coupons: types.filter((t) => t === "COUPON").length,
      amorts: types.filter((t) => t === "AMORT").length,
      replaced,
      unknown: [...unknown],
    };
  });

export const upsertTaxLot = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().optional(),
      assetId: z.string().min(1),
      quantity: z.number().positive(),
      costPerUnit: z.number().min(0),
      currency: z.string().default("USD"),
      purchasedAt: z.string(),
      notes: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id || crypto.randomUUID();
    await sql.query(
      `insert into tax_lots (id, asset_id, quantity, cost_per_unit, currency, purchased_at, notes)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (id) do update set
         asset_id = excluded.asset_id,
         quantity = excluded.quantity,
         cost_per_unit = excluded.cost_per_unit,
         currency = excluded.currency,
         purchased_at = excluded.purchased_at,
         notes = excluded.notes`,
      [
        id,
        data.assetId,
        data.quantity,
        data.costPerUnit,
        data.currency || "USD",
        data.purchasedAt.slice(0, 10),
        data.notes || null,
      ],
    );
    return { id };
  });

export const deleteTaxLot = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from tax_lots where id = ${data.id}`;
    return { ok: true };
  });

export const upsertWatchItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().optional(),
      ticker: z.string().min(1),
      name: z.string().optional().nullable(),
      type: z.string().default("STOCK"),
      notes: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id || crypto.randomUUID();
    await sql.query(
      `insert into watchlist (id, ticker, name, type, currency, notes, updated_at)
       values ($1,$2,$3,$4,'USD',$5, now())
       on conflict (id) do update set
         ticker = excluded.ticker,
         name = excluded.name,
         type = excluded.type,
         notes = excluded.notes,
         updated_at = now()`,
      [
        id,
        data.ticker.trim().toUpperCase(),
        data.name || null,
        data.type || "STOCK",
        data.notes || null,
      ],
    );
    return { id };
  });

export const deleteWatchItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from watchlist where id = ${data.id}`;
    return { ok: true };
  });

export const refreshWatchlistPrices = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql`select id, ticker, type from watchlist`;
    if (rows.length === 0) return { updated: 0 };
    const cryptoTickers = rows
      .filter((r) => String(r.type) === "CRYPTO")
      .map((r) => String(r.ticker).toUpperCase());
    const stockTickers = rows
      .filter((r) => String(r.type) !== "CRYPTO")
      .map((r) => String(r.ticker).toUpperCase());
    const [crypto, stocks] = await Promise.all([
      fetchCryptoUsd(cryptoTickers),
      fetchStockUsd(stockTickers),
    ]);
    const ids: string[] = [];
    const prices: number[] = [];
    for (const r of rows) {
      const ticker = String(r.ticker).toUpperCase();
      const price =
        String(r.type) === "CRYPTO" ? crypto[ticker] : stocks[ticker];
      if (price == null || price <= 0) continue;
      ids.push(String(r.id));
      prices.push(price);
    }
    if (ids.length > 0) {
      await sql.query(
        `update watchlist w set last_price = v.price, updated_at = now()
           from unnest($1::text[], $2::numeric[]) as v(id, price)
          where w.id = v.id`,
        [ids, prices],
      );
    }
    return { updated: ids.length };
  });
