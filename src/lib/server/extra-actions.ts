import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { fetchCryptoUsd, fetchStockUsd } from "@/lib/prices";

export const upsertLiability = createServerFn({ method: "POST" })
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
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from liabilities where id = ${data.id}`;
    return { ok: true };
  });

export const importTransactionsCsv = createServerFn({ method: "POST" })
  .validator(
    z.object({
      rows: z.array(
        z.object({
          date: z.string(),
          description: z.string().min(1),
          amount: z.number(),
          currency: z.string().default("USD"),
          type: z.string().default("INCOME"),
          category: z.string().optional().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    let inserted = 0;
    for (const row of data.rows) {
      if (!row.date || !row.description) continue;
      await sql.query(
        `insert into transactions (id, date, description, amount, currency, type, category)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          crypto.randomUUID(),
          row.date.slice(0, 10),
          row.description.trim(),
          row.amount,
          row.currency || "USD",
          row.type || "INCOME",
          row.category || null,
        ],
      );
      inserted += 1;
    }
    return { inserted };
  });

export const upsertTaxLot = createServerFn({ method: "POST" })
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
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from tax_lots where id = ${data.id}`;
    return { ok: true };
  });

export const upsertWatchItem = createServerFn({ method: "POST" })
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
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from watchlist where id = ${data.id}`;
    return { ok: true };
  });

export const refreshWatchlistPrices = createServerFn({ method: "POST" }).handler(
  async () => {
    const sql = await getSql();
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await sql`select id, ticker, type from watchlist`;
    } catch {
      return { updated: 0 };
    }
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
    let updated = 0;
    for (const r of rows) {
      const ticker = String(r.ticker).toUpperCase();
      const price =
        String(r.type) === "CRYPTO" ? crypto[ticker] : stocks[ticker];
      if (price == null || price <= 0) continue;
      await sql.query(
        `update watchlist set last_price = $1, updated_at = now() where id = $2`,
        [price, r.id],
      );
      updated += 1;
    }
    return { updated };
  },
);
