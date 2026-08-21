-- Patrimonio schema (unowned single-ledger; auth off)
-- Drops leftover Prisma tables from the previous Next.js deploy so columns match.

drop table if exists price_history cascade;
drop table if exists transactions cascade;
drop table if exists recurring_incomes cascade;
drop table if exists assets cascade;
drop table if exists accounts cascade;
drop table if exists net_worth_snapshots cascade;
drop table if exists exchange_rates cascade;
drop table if exists snapshots cascade;
drop table if exists fx_rates cascade;
drop table if exists fx_settings cascade;

create table if not exists fx_rates (
  id integer primary key check (id = 1),
  official numeric(18, 4) not null default 1420,
  blue numeric(18, 4) not null default 1480,
  mep numeric(18, 4) not null default 1455,
  updated_at timestamptz not null default now()
);

create table if not exists accounts (
  id text primary key,
  name text not null,
  institution text,
  type text not null default 'bank',
  currency text not null default 'USD',
  balance numeric(18, 4) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assets (
  id text primary key,
  name text not null,
  ticker text,
  type text not null,
  quantity numeric(18, 8),
  cost_basis numeric(18, 4) not null default 0,
  currency text not null default 'USD',
  current_value numeric(18, 4) not null default 0,
  purchase_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recurring_incomes (
  id text primary key,
  asset_id text not null references assets(id) on delete cascade,
  name text not null,
  amount numeric(18, 4) not null,
  currency text not null default 'USD',
  frequency text not null default 'MONTHLY',
  next_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id text primary key,
  date date not null,
  description text not null,
  amount numeric(18, 4) not null,
  currency text not null default 'USD',
  type text not null,
  category text,
  asset_id text references assets(id) on delete set null,
  account_id text references accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists snapshots (
  date date primary key,
  total_usd numeric(18, 4) not null
);

insert into fx_rates (id, official, blue, mep)
values (1, 1420, 1480, 1455)
on conflict (id) do nothing;

insert into accounts (id, name, institution, type, currency, balance) values
  ('acc-galicia', 'Banco Galicia ARS', 'Banco Galicia', 'bank', 'ARS', 2450000),
  ('acc-santander', 'Banco Santander USD', 'Banco Santander', 'bank', 'USD', 4200),
  ('acc-binance', 'Binance USDT', 'Binance', 'exchange', 'USDT', 3150),
  ('acc-ib', 'Interactive Brokers Cash', 'Interactive Brokers', 'broker', 'USD', 1800),
  ('acc-cash', 'Efectivo físico', 'Efectivo', 'physical', 'ARS', 320)
on conflict (id) do nothing;

insert into assets (id, name, ticker, type, quantity, cost_basis, current_value, currency, purchase_date) values
  ('ast-btc', 'Bitcoin', 'BTC', 'CRYPTO', 0.85, 44350, 52400, 'USD', '2024-11-15'),
  ('ast-aapl', 'Apple', 'AAPL', 'STOCK', 45, 7650, 8200, 'USD', '2025-03-10'),
  ('ast-al30', 'Bono AL30', 'AL30', 'BOND', 1, 4800, 5125, 'USD', '2025-01-20'),
  ('ast-apto', 'Departamento Palermo', null, 'REAL_ESTATE', 1, 28500, 35000, 'USD', '2023-06-01')
on conflict (id) do nothing;

insert into recurring_incomes (id, asset_id, name, amount, currency, frequency, next_date) values
  ('rec-rent', 'ast-apto', 'Alquiler mensual', 1200, 'USD', 'MONTHLY', '2026-09-01'),
  ('rec-coupon', 'ast-al30', 'Cupón', 275, 'USD', 'SEMI_ANNUAL', '2027-01-15')
on conflict (id) do nothing;

insert into transactions (id, date, description, amount, currency, type, category, asset_id, account_id) values
  ('tx-1', '2026-08-18', 'Compra Bitcoin', -1250, 'USD', 'BUY', 'Crypto', 'ast-btc', null),
  ('tx-2', '2026-08-17', 'Dividendo AAPL', 145.3, 'USD', 'DIVIDEND', 'Stocks', 'ast-aapl', null),
  ('tx-3', '2026-08-15', 'Alquiler Palermo', 1200, 'USD', 'RENT', 'Real Estate', 'ast-apto', null),
  ('tx-4', '2026-08-14', 'Transferencia a ahorro', -500, 'USD', 'TRANSFER', 'Cash', null, 'acc-santander'),
  ('tx-5', '2026-08-12', 'Cupón AL30', 275, 'USD', 'COUPON', 'Bonds', 'ast-al30', null),
  ('tx-6', '2026-08-08', 'Supermercado', -186, 'USD', 'EXPENSE', 'Food', null, null),
  ('tx-7', '2026-08-04', 'Expensas', -420, 'USD', 'EXPENSE', 'Housing', null, null)
on conflict (id) do nothing;

insert into snapshots (date, total_usd) values
  ('2025-08-01', 89000),
  ('2025-09-01', 91000),
  ('2025-10-01', 94500),
  ('2025-11-01', 98000),
  ('2025-12-01', 102000),
  ('2026-01-01', 108000),
  ('2026-02-01', 112500),
  ('2026-03-01', 117000),
  ('2026-04-01', 121000),
  ('2026-05-01', 124850),
  ('2026-06-01', 122400),
  ('2026-07-01', 123900),
  ('2026-08-01', 124850)
on conflict (date) do nothing;
