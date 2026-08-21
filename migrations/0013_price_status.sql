-- An asset whose price could not be fetched used to sit at current_value = 0.
--
-- Zero is not "unknown": it flows into net worth, allocation, weights, P&L and
-- concentration as a real number, quietly understating the book. This records
-- whether a value came from a live quote, so the app can fall back to cost and
-- say so instead of showing a confident zero.

alter table assets
  add column if not exists price_status text not null default 'MANUAL';

-- Optional pin for when a ticker resolves to the wrong instrument
-- (e.g. a CoinGecko id for an ambiguous symbol).
alter table assets
  add column if not exists price_id text;

-- Anything already carrying a value was entered by hand; leave it alone.
update assets set price_status = 'MANUAL' where price_status is null;
