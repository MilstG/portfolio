-- Real purchase dates for the twelve ONs.
--
-- 0005 seeded every bond with 2026-08-20, the day the book was imported rather
-- than the day each was bought. Purchase date drives the annualised return, so
-- one shared, wrong date collapsed the whole window to a few weeks: the
-- portfolio rate was being computed over 51 days and every bond row read
-- "< 1m". The panel was extrapolating a month into a year.
--
-- Derived from the broker's DPT column (days since purchase) as of 2026-08-21,
-- so each date is that snapshot minus DPT. Cost basis is untouched: 0005
-- already carries the broker's V. Inicial for each bond.
--
-- Idempotent, keyed on ticker, and a no-op where the bond is absent.

-- CICAO: DPT 263 -> 0.72 años
update assets set purchase_date = '2025-12-01', updated_at = now()
 where upper(ticker) = 'CICAO';

-- GYC5O: DPT 540 -> 1.48 años
update assets set purchase_date = '2025-02-27', updated_at = now()
 where upper(ticker) = 'GYC5O';

-- HJCIO: DPT 456 -> 1.25 años
update assets set purchase_date = '2025-05-22', updated_at = now()
 where upper(ticker) = 'HJCIO';

-- IRCPO: DPT 494 -> 1.35 años
update assets set purchase_date = '2025-04-14', updated_at = now()
 where upper(ticker) = 'IRCPO';

-- MCC1O: DPT 533 -> 1.46 años
update assets set purchase_date = '2025-03-06', updated_at = now()
 where upper(ticker) = 'MCC1O';

-- MCC3O: DPT 106 -> 0.29 años
update assets set purchase_date = '2026-05-07', updated_at = now()
 where upper(ticker) = 'MCC3O';

-- MGCRO: DPT 275 -> 0.75 años
update assets set purchase_date = '2025-11-19', updated_at = now()
 where upper(ticker) = 'MGCRO';

-- OT42O: DPT 542 -> 1.48 años
update assets set purchase_date = '2025-02-25', updated_at = now()
 where upper(ticker) = 'OT42O';

-- PLC3O: DPT 479 -> 1.31 años
update assets set purchase_date = '2025-04-29', updated_at = now()
 where upper(ticker) = 'PLC3O';

-- PLC4O: DPT 445 -> 1.22 años
update assets set purchase_date = '2025-06-02', updated_at = now()
 where upper(ticker) = 'PLC4O';

-- VSCVO: DPT 436 -> 1.19 años
update assets set purchase_date = '2025-06-11', updated_at = now()
 where upper(ticker) = 'VSCVO';

-- ZZC1O: DPT 549 -> 1.50 años
update assets set purchase_date = '2025-02-18', updated_at = now()
 where upper(ticker) = 'ZZC1O';
