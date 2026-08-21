#!/usr/bin/env node
/**
 * End-to-end check of the price refresh, with the network stubbed.
 *
 * The upstreams are unreachable from CI and from the dev sandbox, so the wiring
 * between "an asset has a ticker or a contract address" and "its value gets
 * written" was never actually exercised — only the parsers were. This runs the
 * real runPriceRefresh against a real (in-memory) database with fetch replaced,
 * which is where the chain breaks in practice.
 *
 * Uses PGLite: it must run with no DATABASE_URL so nothing real is touched.
 */
import { createServer } from "vite";

if (process.env.DATABASE_URL) {
  console.error("[test] refusing to run against a real DATABASE_URL");
  process.exit(1);
}

const GP_CONTRACT = "31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk";
let fail = 0;
const check = (ok, label, detail = "") => {
  console.log(ok ? "PASS" : "FAIL", label, detail);
  if (!ok) fail++;
};

/** Routes stubbed responses by URL so each upstream can be exercised alone. */
function installFetchStub(handlers) {
  globalThis.fetch = async (url) => {
    const href = String(url);
    for (const [pattern, body] of handlers) {
      if (href.includes(pattern)) {
        return {
          ok: true,
          status: 200,
          json: async () => body,
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const { getSql } = await server.ssrLoadModule("/src/lib/db.ts");
  const { runPriceRefresh } = await server.ssrLoadModule(
    "/src/lib/server/portfolio.ts",
  );
  const sql = await getSql();

  // A holder's book: a token pinned by contract, an unpinned altcoin, a CEDEAR,
  // and a US equity. All start at zero value, as they would after being added
  // without a price.
  await sql.query(`delete from assets`);
  await sql.query(
    `insert into assets (id, name, ticker, type, quantity, cost_basis, current_value, currency, price_id)
     values
       ('t-gp','Graphite Protocol','GP','CRYPTO',1000,5000,0,'USD',$1),
       ('t-btc','Bitcoin','BTC','CRYPTO',0.5,20000,0,'USD',null),
       ('t-brkb','CEDEAR Berkshire','BRKB','CEDEAR',3495,81164,0,'USD',null),
       ('t-aapl','Apple','AAPL','STOCK',10,1500,0,'USD',null)`,
    [`solana:${GP_CONTRACT}`],
  );

  installFetchStub([
    // GP priced by contract address, not by symbol.
    [`token_price/solana`, { [GP_CONTRACT]: { usd: 0.0125 } }],
    ["simple/price", { bitcoin: { usd: 60000 } }],
    ["finance/chart/AAPL", { chart: { result: [{ meta: { regularMarketPrice: 190 } }] } }],
    ["arg_cedears", [{ symbol: "BRKB", c: 35250 }]],
    ["arg_corps", []],
    ["arg_bonds", []],
    [
      "dolarapi.com",
      [
        { casa: "oficial", venta: 1000 },
        { casa: "blue", venta: 1500 },
        { casa: "bolsa", venta: 1410 },
      ],
    ],
  ]);

  const r = await runPriceRefresh();
  console.log(
    `\n[refresh] ${r.updated} actualizados · crypto ${r.crypto}/${r.cryptoWanted} · ` +
      `acciones ${r.stocks}/${r.stocksWanted} · cedears ${r.cedears}/${r.cedearsWanted} · ` +
      `FX ${r.fx ? "ok" : "sin datos"}` +
      (r.unpriced.length ? ` · sin precio: ${r.unpriced.join(", ")}` : ""),
  );

  const rows = await sql.query(
    `select id, current_value from assets order by id`,
  );
  const value = (id) => Number(rows.find((x) => x.id === id)?.current_value ?? 0);
  const near = (a, b) => Math.abs(a - b) < 0.01;

  console.log("");
  // The point of a contract address: quantity x fetched unit price, no manual entry.
  check(near(value("t-gp"), 12.5), "GP por contract address", `-> ${value("t-gp")} (1000 x 0.0125)`);
  check(near(value("t-btc"), 30000), "BTC por símbolo", `-> ${value("t-btc")}`);
  // CEDEAR: ARS quote / MEP x nominales.
  check(
    near(value("t-brkb"), (3495 * 35250) / 1410),
    "BRKB CEDEAR vía MEP",
    `-> ${value("t-brkb").toFixed(2)} (3495 x 35250 / 1410)`,
  );
  check(near(value("t-aapl"), 1900), "AAPL por Yahoo", `-> ${value("t-aapl")}`);
  check(r.unpriced.length === 0, "ningún activo queda sin precio", `-> ${JSON.stringify(r.unpriced)}`);
  check(r.fx === true, "FX actualizado");

  // A token nobody can price must be reported, not silently zeroed.
  await sql.query(`update assets set current_value = 0 where id = 't-gp'`);
  await sql.query(`update assets set price_id = 'solana:NOPE' where id = 't-gp'`);
  installFetchStub([["simple/price", { bitcoin: { usd: 60000 } }]]);
  const r2 = await runPriceRefresh();
  check(
    r2.unpriced.some((u) => u.includes("Graphite")),
    "un token no cotizable se reporta por nombre",
    `-> ${JSON.stringify(r2.unpriced)}`,
  );
} catch (err) {
  console.error("[test] error:", err);
  fail++;
} finally {
  await server.close();
}

console.log(fail === 0 ? "\nTODOS OK" : `\n${fail} FALLARON`);
process.exit(fail === 0 ? 0 : 1);
