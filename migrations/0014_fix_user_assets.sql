-- Repairs three positions that could never be priced, and so sat at 0.
--
-- ASTS and BRKB are CEDEARs, not US equities. Pricing them off the underlying
-- Yahoo ticker is a different instrument: BRKB is not even a Yahoo symbol
-- (BRK-B is), and ASTS *does* resolve there — to the US share price, not the
-- CEDEAR's. CEDEARs quote in pesos and bake in their conversion ratio, so the
-- CEDEAR feed divided by MEP is the per-unit figure the broker shows.
--
-- GP (Graphite Protocol) is an SPL token whose symbol matches several coins on
-- CoinGecko. Its contract address identifies exactly one, so it is pinned.
--
-- Values come from the holder's broker (2026-08-21 17:00): ASTS 3466 nominales
-- at u$s 4,725 = u$s 16.377; BRKB 3495 at u$s 23,50 = u$s 82.133. They are a
-- starting point, not a fixture — the next successful refresh overwrites them.
--
-- Every statement is an UPDATE keyed on ticker, so it is a no-op on a database
-- that does not have these positions.

update assets
set type = 'CEDEAR',
    quantity = 3466,
    current_value = 16377,
    price_status = 'LIVE',
    updated_at = now()
where upper(coalesce(ticker,'')) in ('ASTS','ASTS.BA')
   or upper(name) like '%SPACEMOBILE%';

update assets
set type = 'CEDEAR',
    quantity = 3495,
    current_value = 82133,
    price_status = 'LIVE',
    updated_at = now()
-- Ticker variants because a holder may have typed the US notation.
where upper(coalesce(ticker,'')) in ('BRKB','BRK.B','BRK-B','BRKB.BA')
   or upper(name) like '%BERKSHIRE%';

update assets
set price_id = 'solana:31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk',
    updated_at = now()
where (upper(coalesce(ticker,'')) = 'GP' or upper(name) like '%GRAPHITE%')
  and type = 'CRYPTO';
