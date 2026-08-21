-- Repairs the CEDEAR positions. Supersedes 0014, which cannot be amended: the
-- runner keys `_migrations` by filename, so editing an already-applied file is
-- inert on any database that ran it. Fixes go in a new file, always.
--
-- BRKB came out of 0014 without a quantity, and a CEDEAR without one cannot be
-- valued at all — the refresh was writing a per-unit price into a position-level
-- column, which is where the -99.4% came from.
--
-- Broker figures (2026-08-21 17:00): ASTS 3466 nominales at u$s 4,725 =
-- u$s 16.377; BRKB 3495 at u$s 23,50 = u$s 82.133. A starting point, not a
-- fixture: the next successful refresh recomputes value from quantity x price.

update assets
set type = 'CEDEAR',
    quantity = 3466,
    cost_basis = case when cost_basis > 0 then cost_basis else 19999 end,
    current_value = 16377,
    updated_at = now()
where upper(coalesce(ticker, '')) in ('ASTS', 'ASTS.BA')
   or upper(name) like '%SPACEMOBILE%'
   or upper(name) = 'ASTS';

update assets
set type = 'CEDEAR',
    quantity = 3495,
    cost_basis = case when cost_basis > 0 then cost_basis else 81164 end,
    current_value = 82133,
    updated_at = now()
where upper(coalesce(ticker, '')) in ('BRKB', 'BRK.B', 'BRK-B', 'BRKB.BA')
   or upper(name) like '%BERKSHIRE%'
   or upper(name) = 'BRKB';

update assets
set price_id = 'solana:31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk',
    updated_at = now()
where type = 'CRYPTO'
  and (upper(coalesce(ticker, '')) = 'GP' or upper(name) like '%GRAPHITE%');
