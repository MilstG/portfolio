-- Next coupon as recurring_incomes for each ON (feeds yield + projected if schedule txs missing)
insert into recurring_incomes (id, asset_id, name, amount, currency, frequency, next_date, notes) values
  ('rec-cicao-c', 'bond-cicao', 'Cupon CICAO', 401.096, 'USD', 'SEMI_ANNUAL', '2026-12-03', 'ON'),
  ('rec-gyc5o-c', 'bond-gyc5o', 'Cupon GYC5O', 214.086, 'USD', 'QUARTERLY', '2026-09-05', 'ON'),
  ('rec-hjcio-c', 'bond-hjcio', 'Cupon HJCIO', 378.082, 'USD', 'SEMI_ANNUAL', '2026-11-27', 'ON'),
  ('rec-ircpo-c', 'bond-ircpo', 'Cupon IRCPO', 839.88, 'USD', 'SEMI_ANNUAL', '2026-09-30', 'ON'),
  ('rec-mcc1o-c', 'bond-mcc1o', 'Cupon MCC1O', 398.247, 'USD', 'SEMI_ANNUAL', '2026-09-10', 'ON'),
  ('rec-mcc3o-c', 'bond-mcc3o', 'Cupon MCC3O', 378.082, 'USD', 'SEMI_ANNUAL', '2026-11-11', 'ON'),
  ('rec-mgcro-c', 'bond-mgcro', 'Cupon MGCRO', 387.5, 'USD', 'SEMI_ANNUAL', '2026-11-14', 'ON'),
  ('rec-ot42o-c', 'bond-ot42o', 'Cupon OT42O', 201.644, 'USD', 'SEMI_ANNUAL', '2026-10-17', 'ON'),
  ('rec-plc3o-c', 'bond-plc3o', 'Cupon PLC3O', 365.479, 'USD', 'SEMI_ANNUAL', '2027-01-30', 'ON'),
  ('rec-plc4o-c', 'bond-plc4o', 'Cupon PLC4O', 425.0, 'USD', 'SEMI_ANNUAL', '2026-11-30', 'ON'),
  ('rec-vscvo-c', 'bond-vscvo', 'Cupon VSCVO', 425.0, 'USD', 'SEMI_ANNUAL', '2026-12-10', 'ON'),
  ('rec-zzc1o-c', 'bond-zzc1o', 'Cupon ZZC1O', 400.767, 'USD', 'SEMI_ANNUAL', '2027-02-21', 'ON')
on conflict (id) do update set
  amount = excluded.amount,
  frequency = excluded.frequency,
  next_date = excluded.next_date,
  notes = excluded.notes;
