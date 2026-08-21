/** Live price helpers — CoinGecko for crypto, Yahoo chart for equities. */

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

export async function fetchCryptoUsd(tickers: string[]): Promise<Record<string, number>> {
  const ids = new Set<string>();
  const map: Record<string, string> = {};
  for (const t of tickers) {
    const key = t.toUpperCase();
    const id = COIN_IDS[key];
    if (id) {
      ids.add(id);
      map[id] = key;
    }
  }
  if (ids.size === 0) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${[...ids].join(",")}&vs_currencies=usd`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return {};
  const json = (await res.json()) as Record<string, { usd?: number }>;
  const out: Record<string, number> = {};
  for (const [id, body] of Object.entries(json)) {
    const ticker = map[id];
    if (ticker && typeof body.usd === "number") out[ticker] = body.usd;
  }
  return out;
}

export async function fetchStockUsd(tickers: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of tickers) {
    const symbol = t.toUpperCase();
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 PatrimonioTracker/1.0" },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
      };
      const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof price === "number" && price > 0) out[symbol] = price;
    } catch {
      // skip failed ticker
    }
  }
  return out;
}
