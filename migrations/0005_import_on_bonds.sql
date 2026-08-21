-- Import user ON bond portfolio + payment schedule (DetallePagos.xlsx)
-- Idempotent: upserts by stable ids bond-{ticker}

-- Bonds (from portfolio screenshot 2026-08-21)
insert into assets (id, name, ticker, type, quantity, cost_basis, currency, current_value, purchase_date, notes)
values ('bond-cicao', 'ON CICAO', 'CICAO', 'BOND', 10000, 9602, 'USD', 10443, '2026-08-20', 'ON · nominales 10000 · precio 1.044285')
on conflict (id) do update set
  name = excluded.name,
  ticker = excluded.ticker,
  type = excluded.type,
  quantity = excluded.quantity,
  cost_basis = excluded.cost_basis,
  currency = excluded.currency,
  current_value = excluded.current_value,
  purchase_date = excluded.purchase_date,
  notes = excluded.notes,
  updated_at = now();

insert into assets (id, name, ticker, type, quantity, cost_basis, currency, current_value, purchase_date, notes)
values ('bond-gyc5o', 'ON GYC5O', 'GYC5O', 'BOND', 9707, 8644, 'USD', 9905, '2026-08-20', 'ON · nominales 9707 · precio 1.020442')
on conflict (id) do update set
  name = excluded.name,
  ticker = excluded.ticker,
  type = excluded.type,
  quantity = excluded.quantity,
  cost_basis = excluded.cost_basis,
  currency = excluded.currency,
  current_value = excluded.current_value,
  purchase_date = excluded.purchase_date,
  notes = excluded.notes,
  updated_at = now();

insert into assets (id, name, ticker, type, quantity, cost_basis, currency, current_value, purchase_date, notes)
values ('bond-hjcio', 'ON HJCIO', 'HJCIO', 'BOND', 10000, 9251, 'USD', 10356, '2026-08-20', 'ON · nominales 10000 · precio 1.035633')
on conflict (id) do update set
  name = excluded.name,
  ticker = excluded.ticker,
  type = excluded.type,
  quantity = excluded.quantity,
  cost_basis = excluded.cost_basis,
  currency = excluded.currency,
  current_value = excluded.current_value,
  purchase_date = excluded.purchase_date,
  notes = excluded.notes,
  updated_at = now();

insert into assets (id, name, ticker, type, quantity, cost_basis, currency, current_value, purchase_date, notes)
values ('bond-ircpo', 'ON IRCPO', 'IRCPO', 'BOND', 20997, 18117, 'USD', 23382, '2026-08-20', 'ON · nominales 20997 · precio 1.11357')
on conflict (id) do update set
  name = excluded.name,
  ticker = excluded.ticker,
  type = excluded.type,
  quantity = excluded.quantity,
  cost_basis = excluded.cost_basis,
  currency = excluded.currency,
  current_value = excluded.current_value,
  purchase_date = excluded.purchase_date,
  notes = excluded.notes,
  updated_at = now();

insert into assets (id, name, ticker, type, quantity, cost_basis, currency, current_value, purchase_date, notes)
values ('bond-mcc1o', 'ON MCC1O', 'MCC1O', 'BOND', 10000, 9210, 'USD', 10746, '2026-08-20', 'ON · nominales 10000 · precio 1.074601')
on conflict (id) do update set
  name = excluded.name,
  ticker = excluded.ticker,
  type = excluded.type,
  quantity = excluded.quantity,
  cost_basis = excluded.cost_basis,
  currency = excluded.currency,
  current_value = excluded.current_value,
  purchase_date = excluded.purchase_date,
  notes = excluded.notes,
  updated_at = now();

insert into assets (id, name, ticker, type, quantity, cost_basis, currency, current_value, purchase_date, notes)
values ('bond-mcc3o', 'ON MCC3O', 'MCC3O', 'BOND', 10000, 10000, 'USD', 10278, '2026-08-20', 'ON · nominales 10000 · precio 1.027773')
on conflict (id) do update set
  name = excluded.name,
  ticker = excluded.ticker,
  type = excluded.type,
  quantity = excluded.quantity,
  cost_basis = excluded.cost_basis,
  currency = excluded.currency,
  current_value = excluded.current_value,
  purchase_date = excluded.purchase_date,
  notes = excluded.notes,
  updated_at = now();

insert into assets (id, name, ticker, type, quantity, cost_basis, currency, current_value, purchase_date, notes)
values ('bond-mgcro', 'ON MGCRO', 'MGCRO', 'BOND', 10000, 9608, 'USD', 10792, '2026-08-20', 'ON · nominales 10000 · precio 1.079225')
on conflict (id) do update set
  name = excluded.name,
  ticker = excluded.ticker,
  type = excluded.type,
  quantity = excluded.quantity,
  cost_basis = excluded.cost_basis,
  currency = excluded.currency,
  current_value = excluded.current_value,
  purchase_date = excluded.purchase_date,
  notes = excluded.notes,
  updated_at = now();

insert into assets (id, name, ticker, type, quantity, cost_basis, currency, current_value, purchase_date, notes)
values ('bond-ot42o', 'ON OT42O', 'OT42O', 'BOND', 10000, 8928, 'USD', 10766, '2026-08-20', 'ON · nominales 10000 · precio 1.076649')
on conflict (id) do update set
  name = excluded.name,
  ticker = excluded.ticker,
  type = excluded.type,
  quantity = excluded.quantity,
  cost_basis = excluded.cost_basis,
  currency = excluded.currency,
  current_value = excluded.current_value,
  purchase_date = excluded.purchase_date,
  notes = excluded.notes,
  updated_at = now();

insert into assets (id, name, ticker, type, quantity, cost_basis, currency, current_value, purchase_date, notes)
values ('bond-plc3o', 'ON PLC3O', 'PLC3O', 'BOND', 10000, 9094, 'USD', 10511, '2026-08-20', 'ON · nominales 10000 · precio 1.051088')
on conflict (id) do update set
  name = excluded.name,
  ticker = excluded.ticker,
  type = excluded.type,
  quantity = excluded.quantity,
  cost_basis = excluded.cost_basis,
  currency = excluded.currency,
  current_value = excluded.current_value,
  purchase_date = excluded.purchase_date,
  notes = excluded.notes,
  updated_at = now();

insert into assets (id, name, ticker, type, quantity, cost_basis, currency, current_value, purchase_date, notes)
values ('bond-plc4o', 'ON PLC4O', 'PLC4O', 'BOND', 10000, 9150, 'USD', 11222, '2026-08-20', 'ON · nominales 10000 · precio 1.122156')
on conflict (id) do update set
  name = excluded.name,
  ticker = excluded.ticker,
  type = excluded.type,
  quantity = excluded.quantity,
  cost_basis = excluded.cost_basis,
  currency = excluded.currency,
  current_value = excluded.current_value,
  purchase_date = excluded.purchase_date,
  notes = excluded.notes,
  updated_at = now();

insert into assets (id, name, ticker, type, quantity, cost_basis, currency, current_value, purchase_date, notes)
values ('bond-vscvo', 'ON VSCVO', 'VSCVO', 'BOND', 10000, 9260, 'USD', 11352, '2026-08-20', 'ON · nominales 10000 · precio 1.135167')
on conflict (id) do update set
  name = excluded.name,
  ticker = excluded.ticker,
  type = excluded.type,
  quantity = excluded.quantity,
  cost_basis = excluded.cost_basis,
  currency = excluded.currency,
  current_value = excluded.current_value,
  purchase_date = excluded.purchase_date,
  notes = excluded.notes,
  updated_at = now();

insert into assets (id, name, ticker, type, quantity, cost_basis, currency, current_value, purchase_date, notes)
values ('bond-zzc1o', 'ON ZZC1O', 'ZZC1O', 'BOND', 10000, 9205, 'USD', 10053, '2026-08-20', 'ON · nominales 10000 · precio 1.005317')
on conflict (id) do update set
  name = excluded.name,
  ticker = excluded.ticker,
  type = excluded.type,
  quantity = excluded.quantity,
  cost_basis = excluded.cost_basis,
  currency = excluded.currency,
  current_value = excluded.current_value,
  purchase_date = excluded.purchase_date,
  notes = excluded.notes,
  updated_at = now();
