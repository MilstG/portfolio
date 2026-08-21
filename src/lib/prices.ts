/**
 * Live price helpers — CoinGecko for crypto, Yahoo for equities, data912 for
 * Argentine corporate bonds (ONs), dolarapi/bluelytics for the peso.
 *
 * Every fetcher returns null or an empty map on failure rather than throwing:
 * a refresh that cannot reach one source still updates the others.
 */

const TIMEOUT_MS = 8_000;

/**
 * Overrides for tickers whose symbol is ambiguous on CoinGecko (several coins
 * share "BTC"-like symbols). Anything not listed here is resolved dynamically —
 * this map used to be the *only* source, which capped crypto support at these
 * sixteen coins and left everything else unpriced.
 */
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
  const out: Record<string, number> = {};
  const idToTicker = new Map<string, string>();

  // Contract addresses are priced directly — they identify one token exactly,
  // where a symbol may match many. Everything else resolves to a CoinGecko id.
  const contracts: Array<{ key: string; chain: string; address: string }> = [];
  const symbols: string[] = [];
  for (const raw of new Set(tickers)) {
    const parsed = classifyPriceKey(raw);
    if (!parsed) continue;
    if (parsed.kind === "contract") {
      contracts.push({
        key: raw.toUpperCase(),
        chain: parsed.chain,
        address: parsed.address,
      });
    } else {
      symbols.push(raw);
    }
  }

  await Promise.all(
    contracts.map(async ({ key, chain, address }) => {
      const price = await fetchTokenUsd(chain, address);
      if (price != null && price > 0) out[key] = price;
    }),
  );

  const resolved = await Promise.all(
    symbols.map(
      async (raw) => [raw.toUpperCase(), await resolveCoinId(raw)] as const,
    ),
  );
  for (const [key, id] of resolved) if (id) idToTicker.set(id, key);
  if (idToTicker.size === 0) return out;
  const ids = encodeURIComponent([...idToTicker.keys()].join(","));
  const json = await getJson<Record<string, { usd?: number }>>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
    { Accept: "application/json" },
  );
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

/* ------------------------------------------------- dynamic coin resolution */

type CoinSearch = {
  coins?: Array<{
    id?: string;
    symbol?: string;
    market_cap_rank?: number | null;
  }>;
};

/** Resolved ticker -> CoinGecko id, cached for the life of the process. */
const coinIdCache = new Map<string, string | null>();

/**
 * Find the CoinGecko id for an arbitrary ticker.
 *
 * Several coins can share a symbol, so exact symbol matches are preferred and
 * ranked by market cap — an unranked long-tail token should not outrank the
 * real one. A negative result is cached too, so a typo does not re-query on
 * every refresh.
 */
export async function resolveCoinId(ticker: string): Promise<string | null> {
  // A pinned CoinGecko id is a lowercase slug ("graphite-protocol"); a ticker
  // symbol is short and unhyphenated. Take a hyphen as "this is already an id"
  // and skip resolution entirely.
  if (ticker.includes("-")) return ticker.toLowerCase();

  const key = ticker.toUpperCase();
  const known = COIN_IDS[key];
  if (known) return known;
  if (coinIdCache.has(key)) return coinIdCache.get(key) ?? null;

  const json = await getJson<CoinSearch>(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(key)}`,
    { Accept: "application/json" },
  );
  const id = pickCoin(json, key);
  coinIdCache.set(key, id);
  return id;
}

export function pickCoin(json: unknown, ticker: string): string | null {
  const coins = (json as CoinSearch | null)?.coins;
  if (!Array.isArray(coins)) return null;
  const exact = coins.filter(
    (c) => String(c?.symbol ?? "").toUpperCase() === ticker.toUpperCase(),
  );
  const pool = exact.length > 0 ? exact : [];
  if (pool.length === 0) return null;
  pool.sort((a, b) => {
    const ra = a.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
    const rb = b.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
  return pool[0]?.id ?? null;
}

/* ------------------------------------------------------------------ CEDEARs */

/**
 * CEDEAR prices in USD.
 *
 * CEDEARs quote in pesos and already bake in their conversion ratio, so
 * dividing the ARS quote by MEP gives the per-unit USD figure a broker shows.
 * Pricing them off the underlying US ticker is simply a different instrument.
 */
export async function fetchCedearUsd(
  tickers: string[],
  mep: number,
): Promise<Record<string, number>> {
  const wanted = new Set(tickers.map((t) => t.toUpperCase()));
  if (wanted.size === 0 || !(mep > 0)) return {};
  const json = await getJson<unknown>("https://data912.com/live/arg_cedears", {
    Accept: "application/json",
  });
  const quotes = parseCedearQuotes(json);
  const out: Record<string, number> = {};
  for (const [symbol, ars] of Object.entries(quotes)) {
    if (wanted.has(symbol)) out[symbol] = ars / mep;
  }
  return out;
}

/** Same feed shape as the bond endpoints, but the price is absolute ARS. */
export function parseCedearQuotes(rows: unknown): Record<string, number> {
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
    out[symbol] = price;
  }
  return out;
}

/* --------------------------------------------------- contract-address quotes */

export type PriceKey =
  | { kind: "symbol"; value: string }
  | { kind: "id"; value: string }
  | { kind: "contract"; chain: string; address: string };

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
// Base58 excludes 0, O, I and l; Solana addresses land in the 32-44 range.
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Work out what a price key actually is.
 *
 * A contract address is the only unambiguous identifier — "GP" can be a dozen
 * tokens, but an address is exactly one. An explicit "chain:address" wins;
 * otherwise the shape decides.
 */
export function classifyPriceKey(raw: string): PriceKey | null {
  const key = raw.trim();
  if (!key) return null;

  const colon = key.indexOf(":");
  if (colon > 0) {
    const chain = key.slice(0, colon).trim().toLowerCase();
    const address = key.slice(colon + 1).trim();
    if (chain && address) return { kind: "contract", chain, address };
  }
  if (EVM_ADDRESS.test(key)) {
    return { kind: "contract", chain: "ethereum", address: key.toLowerCase() };
  }
  // A CoinGecko id is lowercase-with-hyphens and would never be valid base58,
  // so test the address shape only when there is no hyphen.
  if (!key.includes("-") && SOLANA_ADDRESS.test(key) && key.length >= 32) {
    return { kind: "contract", chain: "solana", address: key };
  }
  if (key.includes("-")) return { kind: "id", value: key.toLowerCase() };
  return { kind: "symbol", value: key.toUpperCase() };
}

export function parseTokenPrice(
  json: unknown,
  address: string,
): number | null {
  const body = json as Record<string, { usd?: number }> | null;
  if (!body || typeof body !== "object") return null;
  // The endpoint echoes the address back, sometimes lowercased.
  for (const [addr, entry] of Object.entries(body)) {
    if (addr.toLowerCase() !== address.toLowerCase()) continue;
    return toNum(entry?.usd);
  }
  return null;
}

/** USD price of a token identified by its contract address. */
export async function fetchTokenUsd(
  chain: string,
  address: string,
): Promise<number | null> {
  const json = await getJson<unknown>(
    `https://api.coingecko.com/api/v3/simple/token_price/${encodeURIComponent(chain)}` +
      `?contract_addresses=${encodeURIComponent(address)}&vs_currencies=usd`,
    { Accept: "application/json" },
  );
  return parseTokenPrice(json, address);
}
