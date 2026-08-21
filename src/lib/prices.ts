/**
 * Live price helpers — CoinGecko for crypto, Yahoo for equities, data912 for
 * Argentine corporate bonds (ONs), dolarapi/bluelytics for the peso.
 *
 * Every fetcher returns null or an empty map on failure rather than throwing:
 * a refresh that cannot reach one source still updates the others.
 */

const TIMEOUT_MS = 8_000;

const COIN_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  LTC: "litecoin",
  USDT: "tether",
  USDC: "usd-coin",
};

async function getJson<T>(
  url: string,
  headers: Record<string, string>,
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchCryptoUsd(
  tickers: string[],
): Promise<Record<string, number>> {
  const idToTicker = new Map<string, string>();
  for (const t of tickers) {
    const key = t.toUpperCase();
    const id = COIN_IDS[key];
    if (id) idToTicker.set(id, key);
  }
  if (idToTicker.size === 0) return {};
  const ids = encodeURIComponent([...idToTicker.keys()].join(","));
  const json = await getJson<Record<string, { usd?: number }>>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
    { Accept: "application/json" },
  );
  const out: Record<string, number> = {};
  for (const [id, body] of Object.entries(json ?? {})) {
    const ticker = idToTicker.get(id);
    if (ticker && typeof body.usd === "number") out[ticker] = body.usd;
  }
  return out;
}

type YahooChart = {
  chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
};

export async function fetchStockUsd(
  tickers: string[],
): Promise<Record<string, number>> {
  const symbols = [...new Set(tickers.map((t) => t.toUpperCase()))];
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const json = await getJson<YahooChart>(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
        { "User-Agent": "Mozilla/5.0 PatrimonioTracker/1.0" },
      );
      const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
      return [
        symbol,
        typeof price === "number" && price > 0 ? price : null,
      ] as const;
    }),
  );
  const out: Record<string, number> = {};
  for (const [symbol, price] of results) if (price != null) out[symbol] = price;
  return out;
}

/* ---------------------------------------------------------------- ARS rates */

export type DolarRates = { official: number; blue: number; mep: number };

type DolarApiRow = {
  casa?: string;
  nombre?: string;
  compra?: number | string;
  venta?: number | string;
};

function toNum(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Sell side is what you pay to buy dollars, which is the rate a holder marks at. */
function rowRate(row: DolarApiRow): number | null {
  return toNum(row.venta) ?? toNum(row.compra);
}

export function parseDolarApi(rows: unknown): DolarRates | null {
  if (!Array.isArray(rows)) return null;
  let official: number | null = null;
  let blue: number | null = null;
  let mep: number | null = null;
  for (const raw of rows as DolarApiRow[]) {
    const key = String(raw?.casa ?? raw?.nombre ?? "").toLowerCase();
    const rate = rowRate(raw);
    if (rate == null) continue;
    if (key.includes("oficial")) official ??= rate;
    else if (key.includes("blue")) blue ??= rate;
    // dolarapi calls MEP "bolsa"; some mirrors say "mep" outright.
    else if (key.includes("bolsa") || key.includes("mep")) mep ??= rate;
  }
  if (official == null || blue == null) return null;
  return { official, blue, mep: mep ?? blue };
}

type BluelyticsBody = {
  oficial?: { value_sell?: number; value_avg?: number };
  blue?: { value_sell?: number; value_avg?: number };
};

/** Fallback source. It has no MEP, so MEP falls back to blue. */
export function parseBluelytics(body: unknown): DolarRates | null {
  const b = body as BluelyticsBody | null;
  const official = toNum(b?.oficial?.value_sell ?? b?.oficial?.value_avg);
  const blue = toNum(b?.blue?.value_sell ?? b?.blue?.value_avg);
  if (official == null || blue == null) return null;
  return { official, blue, mep: blue };
}

export async function fetchDolarRates(): Promise<DolarRates | null> {
  const primary = await getJson<unknown>("https://dolarapi.com/v1/dolares", {
    Accept: "application/json",
  });
  const parsed = parseDolarApi(primary);
  if (parsed) return parsed;
  const fallback = await getJson<unknown>(
    "https://api.bluelytics.com.ar/v2/latest",
    { Accept: "application/json" },
  );
  return parseBluelytics(fallback);
}

/* ------------------------------------------------------------- ARS bonds/ONs */

type BondQuote = { symbol?: string; c?: number; px_bid?: number; px_ask?: number; last?: number };

/**
 * Quotes come back per 100 nominal (a bond at 104.43 is trading at 1.0443 times
 * face), which is the factor the assets table stores.
 *
 * Field naming varies across the feed's endpoints, so several are accepted and
 * a bid/ask midpoint is used when there is no close.
 */
export function parseBondQuotes(rows: unknown): Record<string, number> {
  if (!Array.isArray(rows)) return {};
  const out: Record<string, number> = {};
  for (const raw of rows as BondQuote[]) {
    const symbol = String(raw?.symbol ?? "").trim().toUpperCase();
    if (!symbol) continue;
    let price = toNum(raw?.c) ?? toNum(raw?.last);
    if (price == null) {
      const bid = toNum(raw?.px_bid);
      const ask = toNum(raw?.px_ask);
      if (bid != null && ask != null) price = (bid + ask) / 2;
      else price = bid ?? ask;
    }
    if (price == null) continue;
    out[symbol] = price / 100;
  }
  return out;
}

/**
 * Price factors for Argentine corporate bonds, keyed by ticker.
 *
 * Two endpoints because ONs and sovereigns are served separately; a holder can
 * have either. Failures are per-endpoint, so one source being down still
 * returns whatever the other had.
 */
export async function fetchArgBondFactors(
  tickers: string[],
): Promise<Record<string, number>> {
  const wanted = new Set(tickers.map((t) => t.toUpperCase()));
  if (wanted.size === 0) return {};
  const [corps, sovereign] = await Promise.all([
    getJson<unknown>("https://data912.com/live/arg_corps", {
      Accept: "application/json",
    }),
    getJson<unknown>("https://data912.com/live/arg_bonds", {
      Accept: "application/json",
    }),
  ]);
  const all = { ...parseBondQuotes(sovereign), ...parseBondQuotes(corps) };
  const out: Record<string, number> = {};
  for (const [symbol, factor] of Object.entries(all)) {
    if (wanted.has(symbol)) out[symbol] = factor;
  }
  return out;
}
