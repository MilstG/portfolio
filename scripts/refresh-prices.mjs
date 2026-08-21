#!/usr/bin/env node
/**
 * One-shot price refresh, for a real scheduler.
 *
 * The app already refreshes itself when the dashboard is loaded and prices have
 * gone stale (PRICE_REFRESH_MINUTES, default 60). That covers a tracker someone
 * actually opens. Point a cron at this instead when prices should keep moving
 * with nobody looking — Railway cron, GitHub Actions, systemd timer.
 *
 *   node scripts/refresh-prices.mjs
 *
 * Needs DATABASE_URL. Exits non-zero when nothing could be fetched, so a failed
 * run is visible to the scheduler rather than silently doing nothing.
 */
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const { runPriceRefresh } = await server.ssrLoadModule(
    "/src/lib/server/portfolio.ts",
  );
  const r = await runPriceRefresh();
  console.log(
    `[prices] ${r.updated} activo(s) actualizados · crypto ${r.crypto}/${r.cryptoWanted} · acciones ${r.stocks}/${r.stocksWanted} · bonos ${r.bonds}/${r.bondsWanted} · FX ${r.fx ? "ok" : "sin datos"}`,
  );
  const nothing =
    r.updated === 0 &&
    !r.fx &&
    r.cryptoWanted + r.stocksWanted + r.bondsWanted > 0;
  if (nothing) {
    console.error("[prices] ninguna fuente respondió");
    process.exitCode = 1;
  }
} catch (err) {
  console.error("[prices] falló:", err);
  process.exitCode = 1;
} finally {
  await server.close();
}
