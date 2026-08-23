-- Per-position history.
--
-- Until now the only thing recorded over time was one number: the net worth
-- total. That is enough to say the book went up 4% in August and nothing at all
-- about which position did it — a report could show what was collected but not
-- what anything was worth a month ago, so per-asset performance had no source
-- to come from and was left out rather than estimated.
--
-- One row per asset per day, written by the same pass that writes the net worth
-- snapshot, so the two series always agree on the days they both cover.
--
-- Deliberately NOT back-filled. There is no record of what any position was
-- worth before today, and inventing one — by holding today's price constant, or
-- by interpolating the net worth total across positions — would produce a
-- performance history that looks measured and is made up. The series starts the
-- first time this runs and the report says so.
create table if not exists position_snapshots (
  date date not null,
  asset_id text not null references assets (id) on delete cascade,
  -- Value in the asset's own currency, as stored on the position.
  value numeric(18, 4) not null,
  currency text not null,
  -- Converted at the FX of the day, which is kept alongside so a past row can
  -- be read back without guessing which rate produced it.
  value_usd numeric(18, 4) not null,
  fx_used numeric(18, 4) not null,
  -- Null when the position carries no usable quantity. Without it the split
  -- between "the price moved" and "you bought more" cannot be made, and the
  -- report says which positions are in that state instead of assuming one.
  quantity numeric(28, 10),
  -- Cost basis on the day, so a position opened mid-period can be told apart
  -- from one that was held throughout.
  cost_basis numeric(18, 4) not null default 0,
  -- True when the value is the cost basis standing in for a quote that could
  -- not be fetched. A run of these is a flat line that never happened.
  unpriced boolean not null default false,
  primary key (date, asset_id)
);

create index if not exists position_snapshots_asset_date
  on position_snapshots (asset_id, date);
