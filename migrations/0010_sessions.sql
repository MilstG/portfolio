-- Server-side sessions for the PIN lock + indexes for the hot queries.

create table if not exists sessions (
  id text primary key,                      -- sha256(token); the raw token only lives in the cookie
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);

-- A legacy unsalted SHA-256 pin_hash (from before 0010) is invalidated: the
-- owner re-sets the PIN from Settings. Hashes are now scrypt with a salt and
-- stored as "scrypt$<salt_hex>$<hash_hex>".
update app_settings
  set pin_hash = null, pin_enabled = false, updated_at = now()
  where id = 1 and pin_hash is not null and pin_hash not like 'scrypt$%';

create index if not exists transactions_date_idx on transactions(date desc);
create index if not exists recurring_incomes_next_date_idx on recurring_incomes(next_date);
create index if not exists recurring_incomes_asset_idx on recurring_incomes(asset_id);
create index if not exists sessions_expires_idx on sessions(expires_at);
