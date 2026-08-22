-- Amortisation inputs for liabilities.
--
-- A debt was just a balance: no instalments, no split between capital and
-- interest, and nothing reaching the payment calendar. A mortgage or a car loan
-- would sit there as a static number while the money actually left every month.
--
-- With principal + term + start date + rate the schedule is derived (French
-- system, fixed instalment — what a local bank quotes). All four are nullable
-- on purpose: an existing debt with none of them keeps behaving exactly as it
-- did, as a manually maintained balance.

alter table liabilities
  add column if not exists principal numeric(18, 4),
  add column if not exists term_periods integer,
  add column if not exists start_date date,
  add column if not exists payment_frequency text;
