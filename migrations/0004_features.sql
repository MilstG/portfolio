-- Feature pack: liabilities, goals, alloc targets, fx history, app settings, recurring->account

create table if not exists liabilities (
  id text primary key,
  name text not null,
  type text not null default 'loan',
  balance numeric(18, 4) not null default 0,
  currency text not null default 'USD',
  interest_rate numeric(8, 4),
  linked_asset_id text references assets(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists goals (
  id text primary key,
  name text not null,
  target_usd numeric(18, 4) not null,
  target_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists alloc_targets (
  asset_type text primary key,
  target_pct numeric(8, 4) not null default 0
);

create table if not exists fx_history (
  date date primary key,
  official numeric(18, 4) not null,
  blue numeric(18, 4) not null,
  mep numeric(18, 4) not null,
  average numeric(18, 4) not null
);

create table if not exists app_settings (
  id integer primary key check (id = 1),
  pin_hash text,
  pin_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into app_settings (id, pin_enabled) values (1, false)
on conflict (id) do nothing;

insert into alloc_targets (asset_type, target_pct) values
  ('CRYPTO', 0),
  ('STOCK', 0),
  ('BOND', 0),
  ('REAL_ESTATE', 0),
  ('CASH', 0),
  ('OTHER', 0)
on conflict (asset_type) do nothing;

-- optional cash account for recurring payouts
alter table recurring_incomes
  add column if not exists account_id text references accounts(id) on delete set null;
