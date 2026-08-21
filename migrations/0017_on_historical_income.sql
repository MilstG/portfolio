-- Historical ON income actually collected, from the holder's movements export.
--
-- Until now every coupon in the database was a future schedule row, so the
-- return panel had no realised income at all and INGRESOS fell back to
-- projections for every position.
--
-- Shape of the export: each payment lands as two rows — the USD amount received
-- and a negative peso row, which is the fee charged on that coupon. Both are
-- loaded: the USD as COUPON income, the peso leg as an EXPENSE against the same
-- bond.
--
-- Deliberately excluded: four "Movimiento Manual / Renta CV 7.000 a Cable" rows
-- carrying no ticker. They are transfers between two dollar sub-accounts and
-- net to exactly 0.00; counting them would have added USD 1,635.70 of income
-- that was never earned.
--
-- 30 collections totalling USD 10,932.49 and 30 fees totalling ARS 54,832.94,
-- covering 2025-05-27 to 2026-08-21.
-- Ids are prefixed `hist-` so they cannot collide with the `pay-` schedule rows,
-- and the insert is idempotent.
-- Tickers with no matching asset (sold, or never loaded): PQCSO, YM35O, YM37O.
-- Their rows are kept with a null asset_id so the cash totals stay right.

insert into transactions (id, date, description, amount, currency, type, category, asset_id)
values
  ('hist-zzc1o-2026-08-21-renta', '2026-08-21', 'Cupón ZZC1O', 392.8500, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'ZZC1O' limit 1)),
  ('hist-plc3o-2026-07-30-renta', '2026-07-30', 'Cupón PLC3O', 358.2600, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'PLC3O' limit 1)),
  ('hist-ot42o-2026-07-17-renta', '2026-07-17', 'Cupón OT42O', 198.7500, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'OT42O' limit 1)),
  ('hist-vscvo-2026-06-11-renta', '2026-06-11', 'Cupón VSCVO', 423.5100, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'VSCVO' limit 1)),
  ('hist-gyc5o-2026-06-05-renta', '2026-06-05', 'Cupón GYC5O', 213.3300, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'GYC5O' limit 1)),
  ('hist-cicao-2026-06-03-renta', '2026-06-03', 'Cupón CICAO', 397.5000, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'CICAO' limit 1)),
  ('hist-plc4o-2026-06-02-renta', '2026-06-02', 'Cupón PLC4O', 423.5100, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'PLC4O' limit 1)),
  ('hist-hjcio-2026-05-27-renta', '2026-05-27', 'Cupón HJCIO', 369.3500, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'HJCIO' limit 1)),
  ('hist-mgcro-2026-05-15-renta', '2026-05-15', 'Cupón MGCRO', 386.1400, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'MGCRO' limit 1)),
  ('hist-ot42o-2026-04-17-renta', '2026-04-17', 'Cupón OT42O', 196.5700, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'OT42O' limit 1)),
  ('hist-ircpo-2026-04-01-renta', '2026-04-01', 'Cupón IRCPO', 836.9400, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'IRCPO' limit 1)),
  ('hist-mcc1o-2026-03-10-renta', '2026-03-10', 'Cupón MCC1O', 390.3800, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'MCC1O' limit 1)),
  ('hist-gyc5o-2026-03-05-renta', '2026-03-05', 'Cupón GYC5O', 846.3900, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'GYC5O' limit 1)),
  ('hist-zzc1o-2026-02-23-renta', '2026-02-23', 'Cupón ZZC1O', 399.3600, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'ZZC1O' limit 1)),
  ('hist-ym37o-2026-02-09-renta', '2026-02-09', 'Cupón YM37O', 131.8600, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'YM37O' limit 1)),
  ('hist-plc3o-2026-01-30-renta', '2026-01-30', 'Cupón PLC3O', 544.3200, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'PLC3O' limit 1)),
  ('hist-ot42o-2026-01-19-renta', '2026-01-19', 'Cupón OT42O', 200.9300, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'OT42O' limit 1)),
  ('hist-vscvo-2025-12-11-renta', '2025-12-11', 'Cupón VSCVO', 423.5100, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'VSCVO' limit 1)),
  ('hist-plc4o-2025-12-03-renta', '2025-12-03', 'Cupón PLC4O', 423.5100, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'PLC4O' limit 1)),
  ('hist-hjcio-2025-11-27-renta', '2025-11-27', 'Cupón HJCIO', 144.5800, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'HJCIO' limit 1)),
  ('hist-hjcio-2025-11-27-renta-2', '2025-11-27', 'Cupón HJCIO', 232.1600, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'HJCIO' limit 1)),
  ('hist-ym37o-2025-11-07-renta', '2025-11-07', 'Cupón YM37O', 131.8600, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'YM37O' limit 1)),
  ('hist-ot42o-2025-10-17-renta', '2025-10-17', 'Cupón OT42O', 596.2600, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'OT42O' limit 1)),
  ('hist-ircpo-2025-10-01-renta', '2025-10-01', 'Cupón IRCPO', 797.2000, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'IRCPO' limit 1)),
  ('hist-mcc1o-2025-09-10-renta', '2025-09-10', 'Cupón MCC1O', 396.8500, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'MCC1O' limit 1)),
  ('hist-ym35o-2025-08-27-renta', '2025-08-27', 'Cupón YM35O', 78.4800, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'YM35O' limit 1)),
  ('hist-zzc1o-2025-08-21-renta', '2025-08-21', 'Cupón ZZC1O', 392.8500, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'ZZC1O' limit 1)),
  ('hist-pqcso-2025-08-18-renta', '2025-08-18', 'Cupón PQCSO', 397.5000, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'PQCSO' limit 1)),
  ('hist-ym37o-2025-08-07-renta', '2025-08-07', 'Cupón YM37O', 131.8600, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'YM37O' limit 1)),
  ('hist-ym35o-2025-05-27-renta', '2025-05-27', 'Cupón YM35O', 75.9200, 'USD', 'COUPON', 'Bonds', (select id from assets where upper(ticker) = 'YM35O' limit 1)),
  ('hist-zzc1o-2026-08-21-fee', '2026-08-21', 'Comisión ZZC1O', -2090.4000, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'ZZC1O' limit 1)),
  ('hist-plc3o-2026-07-30-fee', '2026-07-30', 'Comisión PLC3O', -1906.3500, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'PLC3O' limit 1)),
  ('hist-ot42o-2026-07-17-fee', '2026-07-17', 'Comisión OT42O', -1043.6200, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'OT42O' limit 1)),
  ('hist-vscvo-2026-06-11-fee', '2026-06-11', 'Comisión VSCVO', -2164.3100, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'VSCVO' limit 1)),
  ('hist-gyc5o-2026-06-05-fee', '2026-06-05', 'Comisión GYC5O', -1090.2000, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'GYC5O' limit 1)),
  ('hist-cicao-2026-06-03-fee', '2026-06-03', 'Comisión CICAO', -2024.4200, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'CICAO' limit 1)),
  ('hist-plc4o-2026-06-02-fee', '2026-06-02', 'Comisión PLC4O', -2149.4400, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'PLC4O' limit 1)),
  ('hist-hjcio-2026-05-27-fee', '2026-05-27', 'Comisión HJCIO', -1855.1000, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'HJCIO' limit 1)),
  ('hist-mgcro-2026-05-15-fee', '2026-05-15', 'Comisión MGCRO', -1919.0900, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'MGCRO' limit 1)),
  ('hist-ot42o-2026-04-17-fee', '2026-04-17', 'Comisión OT42O', -952.7700, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'OT42O' limit 1)),
  ('hist-ircpo-2026-04-01-fee', '2026-04-01', 'Comisión IRCPO', -4130.1100, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'IRCPO' limit 1)),
  ('hist-mcc1o-2026-03-10-fee', '2026-03-10', 'Comisión MCC1O', -1967.5600, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'MCC1O' limit 1)),
  ('hist-gyc5o-2026-03-05-fee', '2026-03-05', 'Comisión GYC5O', -4221.3200, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'GYC5O' limit 1)),
  ('hist-zzc1o-2026-02-23-fee', '2026-02-23', 'Comisión ZZC1O', -1956.7100, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'ZZC1O' limit 1)),
  ('hist-ym37o-2026-02-09-fee', '2026-02-09', 'Comisión YM37O', -671.5200, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'YM37O' limit 1)),
  ('hist-plc3o-2026-01-30-fee', '2026-01-30', 'Comisión PLC3O', -2800.7900, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'PLC3O' limit 1)),
  ('hist-ot42o-2026-01-19-fee', '2026-01-19', 'Comisión OT42O', -1026.8500, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'OT42O' limit 1)),
  ('hist-vscvo-2025-12-11-fee', '2025-12-11', 'Comisión VSCVO', -2171.7500, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'VSCVO' limit 1)),
  ('hist-plc4o-2025-12-03-fee', '2025-12-03', 'Comisión PLC4O', -2201.5000, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'PLC4O' limit 1)),
  ('hist-hjcio-2025-11-27-fee', '2025-11-27', 'Comisión HJCIO', -749.0300, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'HJCIO' limit 1)),
  ('hist-hjcio-2025-11-27-fee-2', '2025-11-27', 'Comisión HJCIO', -1202.7600, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'HJCIO' limit 1)),
  ('hist-ym37o-2025-11-07-fee', '2025-11-07', 'Comisión YM37O', -683.1000, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'YM37O' limit 1)),
  ('hist-ot42o-2025-10-17-fee', '2025-10-17', 'Comisión OT42O', -2994.7400, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'OT42O' limit 1)),
  ('hist-ircpo-2025-10-01-fee', '2025-10-01', 'Comisión IRCPO', -3920.0000, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'IRCPO' limit 1)),
  ('hist-mcc1o-2025-09-10-fee', '2025-09-10', 'Comisión MCC1O', -1986.2200, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'MCC1O' limit 1)),
  ('hist-ym35o-2025-08-27-fee', '2025-08-27', 'Comisión YM35O', -377.6500, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'YM35O' limit 1)),
  ('hist-zzc1o-2025-08-21-fee', '2025-08-21', 'Comisión ZZC1O', -1814.4400, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'ZZC1O' limit 1)),
  ('hist-pqcso-2025-08-18-fee', '2025-08-18', 'Comisión PQCSO', -1828.9600, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'PQCSO' limit 1)),
  ('hist-ym37o-2025-08-07-fee', '2025-08-07', 'Comisión YM37O', -622.9000, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'YM37O' limit 1)),
  ('hist-ym35o-2025-05-27-fee', '2025-05-27', 'Comisión YM35O', -309.3300, 'ARS', 'EXPENSE', 'Fees', (select id from assets where upper(ticker) = 'YM35O' limit 1))
on conflict (id) do update set
  date = excluded.date,
  amount = excluded.amount,
  type = excluded.type,
  asset_id = excluded.asset_id;
