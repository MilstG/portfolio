-- Feature pack: tax lots, price watchlist, recurring income/expense direction

create table if not exists tax_lots (
  id text primary key,
  asset_id text not null references assets(id) on delete cascade,
  quantity numeric(18, 8) not null,
  cost_per_unit numeric(18, 6) not null,
  currency text not null default 'USD',
  purchased_at date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists tax_lots_asset_idx on tax_lots(asset_id);

create table if not exists watchlist (
  id text primary key,
  ticker text not null,
  name text,
  type text not null default 'STOCK',
  last_price numeric(18, 6),
  currency text not null default 'USD',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists watchlist_ticker_uidx on watchlist (upper(ticker));

-- direction: INCOME (default) or EXPENSE. Amount stored as positive; sign applied on projection.
alter table recurring_incomes
  add column if not exists direction text not null default 'INCOME';

alter table recurring_incomes
  drop constraint if exists recurring_incomes_direction_check;

alter table recurring_incomes
  add constraint recurring_incomes_direction_check
  check (direction in ('INCOME', 'EXPENSE'));
