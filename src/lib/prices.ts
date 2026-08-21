/** Live price helpers — CoinGecko for crypto, Yahoo chart for equities. */

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
