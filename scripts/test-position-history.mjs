#!/usr/bin/env node
/**
 * End-to-end check of the per-position history, against a real database.
 *
 * The SQL is the part unit tests cannot reach: the table, the write that runs
 * on every price refresh, and the "latest row per asset at or before a date"
 * query the report reads. All three were new at once, and the report is built
 * on the assumption that they agree with each other.
 *
 * Uses PGLite: it must run with no DATABASE_URL so nothing real is touched.
 */
import { createServer } from "vite";

if (process.env.DATABASE_URL) {
  console.error("[test] refusing to run against a real DATABASE_URL");
  process.exit(1);
}

let fail = 0;
const check = (ok, label, detail = "") => {
  console.log(ok ? "PASS" : "FAIL", label, detail);
  if (!ok) fail++;
};
const near = (a, b, label) => check(Math.abs(a - b) < 0.01, label, `-> ${a}`);

function stubFetch(prices) {
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes("simple/price"))
      return { ok: true, status: 200, json: async () => ({ bitcoin: { usd: prices.btc } }) };
    if (href.includes("finance/chart/AAPL"))
      return {
        ok: true, status: 200,
        json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: prices.aapl } }] } }),
      };
    if (href.includes("dolarapi.com"))
      return {
        ok: true, status: 200,
        json: async () => [
          { casa: "oficial", venta: 1000 },
          { casa: "blue", venta: 1500 },
          { casa: "bolsa", venta: 1410 },
        ],
      };
    return { ok: true, status: 200, json: async () => [] };
  };
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const { getSql } = await server.ssrLoadModule("/src/lib/db.ts");
  const { runPriceRefresh, loadPositionPerformance } =
    await server.ssrLoadModule("/src/lib/server/portfolio.ts");
  const { assetPerformance } = await server.ssrLoadModule("/src/lib/reports.ts");
  const sql = await getSql();

  // The migration has to have created the table before anything else works.
  const cols = await sql.query(
    `select column_name from information_schema.columns
      where table_name = 'position_snapshots' order by column_name`,
  );
  const names = cols.map((c) => c.column_name).join(",");
  check(
    names === "asset_id,cost_basis,currency,date,fx_used,quantity,unpriced,value,value_usd",
    "la migración creó position_snapshots",
    `-> ${names}`,
  );

  await sql.query(`delete from assets`);
  await sql.query(`delete from position_snapshots`);
  await sql.query(
    `insert into assets (id, name, ticker, type, quantity, cost_basis, current_value, currency)
     values
       ('t-btc','Bitcoin','BTC','CRYPTO',2,50000,0,'USD'),
       ('t-aapl','Apple','AAPL','STOCK',100,15000,0,'USD'),
       ('t-re','Depto',null,'REAL_ESTATE',null,100000,120000,'USD')`,
  );

  // Day one, through the real refresh path — the snapshot write is a side
  // effect of it, which is exactly the wiring being checked.
  stubFetch({ btc: 60000, aapl: 190 });
  await runPriceRefresh();
  const today = new Date().toISOString().slice(0, 10);
  const day1 = await sql.query(
    `select asset_id, value_usd, quantity from position_snapshots where date = $1 order by asset_id`,
    [today],
  );
  check(day1.length === 3, "un renglón por posición", `-> ${day1.length}`);
  const v = (id) => Number(day1.find((r) => r.asset_id === id)?.value_usd ?? 0);
  near(v("t-btc"), 120000, "BTC: 2 x 60.000");
  near(v("t-aapl"), 19000, "AAPL: 100 x 190");
  // Real estate carries no quote and no quantity; its stored value is used.
  near(v("t-re"), 120000, "el inmueble se graba con su valor cargado");
  check(
    day1.find((r) => r.asset_id === "t-re")?.quantity == null,
    "sin cantidad se graba null, no 1",
  );

  // The net worth snapshot of the same pass must agree with the sum of the
  // position rows plus cash and debt — they are written together on purpose.
  const [{ total_usd: nw }] = await sql.query(
    `select total_usd from snapshots where date = $1`,
    [today],
  );
  const [{ sum: posSum }] = await sql.query(
    `select sum(value_usd) as sum from position_snapshots where date = $1`,
    [today],
  );
  // At the FX the refresh just wrote, not a hardcoded one: the average moves
  // with every pass and a stale divisor makes this assertion fail for a reason
  // that has nothing to do with what is being tested.
  const [fxRow] = await sql.query(
    `select (official + blue + mep) / 3 as avg from fx_rates where id = 1`,
  );
  const [{ sum: cash }] = await sql.query(
    `select coalesce(sum(case when currency = 'ARS' then balance / $1 else balance end), 0) as sum from accounts`,
    [Number(fxRow.avg)],
  );
  check(
    Math.abs(Number(nw) - (Number(posSum) + Number(cash))) < 1,
    "el snapshot total y las posiciones cierran",
    `-> NW ${Number(nw).toFixed(2)} vs posiciones ${Number(posSum).toFixed(2)} + caja ${Number(cash).toFixed(2)}`,
  );

  // Back-date day one so a second pass lands on a later date, then move the
  // market and buy more of one thing.
  await sql.query(
    `update position_snapshots set date = date '2026-01-01' where date = $1`,
    [today],
  );
  await sql.query(`update assets set quantity = 3 where id = 't-btc'`);
  stubFetch({ btc: 66000, aapl: 171 });
  await runPriceRefresh();

  const perfData = await loadPositionPerformance("2026-01-01", today);
  check(perfData.seriesStart === "2026-01-01", "arranque de la serie", `-> ${perfData.seriesStart}`);
  check(perfData.open.length === 3, "tres posiciones en la apertura");
  const openBtc = perfData.open.find((r) => r.assetId === "t-btc");
  near(openBtc.valueUsd, 120000, "la apertura toma el renglón del 1/1");
  near(Number(openBtc.quantity), 2, "con la cantidad de ese día");

  const perf = assetPerformance(perfData, [
    { id: "t-btc", name: "Bitcoin", ticker: "BTC", type: "CRYPTO" },
    { id: "t-aapl", name: "Apple", ticker: "AAPL", type: "STOCK" },
    { id: "t-re", name: "Depto", ticker: null, type: "REAL_ESTATE" },
  ]);
  const row = (id) => perf.rows.find((r) => r.assetId === id);

  // Comprar un tercer BTC no es una ganancia de 78.000. Los 2 que ya tenía
  // subieron 6.000 cada uno.
  near(row("t-btc").priceUsd, 12000, "BTC: rindió lo que subieron los 2 que ya tenía");
  near(row("t-btc").flowUsd, 66000, "BTC: el tercero es plata que entró");
  near(row("t-btc").changeUsd, 78000, "BTC: el movimiento total");
  near(row("t-btc").pricePct, 10, "BTC: +10%, no +65%");
  // Una caída real sí es pérdida.
  near(row("t-aapl").priceUsd, -1900, "AAPL: pérdida de precio");
  near(row("t-aapl").pricePct, -10, "AAPL: -10%");
  near(row("t-aapl").flowUsd, 0, "AAPL: sin compras");
  check(row("t-re").estimated === true, "el inmueble queda marcado sin cantidad");
  near(
    perf.totalPriceUsd + perf.totalFlowUsd,
    perf.totalChangeUsd,
    "precio + flujo cierra contra la variación total",
  );

  // Antes del arranque de la serie no hay nada, y el panel tiene que poder
  // decirlo en vez de mostrar una apertura inventada.
  const antes = await loadPositionPerformance("2025-06-01", "2025-06-30");
  check(antes.open.length === 0, "antes del arranque no hay apertura");
  check(
    assetPerformance(antes, []).empty === true,
    "y el panel se declara vacío",
  );
} finally {
  await server.close();
}

console.log(fail === 0 ? "\nOK" : `\n${fail} FALLAS`);
process.exit(fail === 0 ? 0 : 1);
