-- Links a transaction to the debt it pays.
--
-- The loan balance was derived from the calendar: every instalment whose date
-- had passed counted as paid. That is a projection, not a fact — an early
-- capital payment, a missed month or a different amount all leave the derived
-- balance quietly wrong.
--
-- With this column a payment is a recorded event, and the outstanding principal
-- is replayed from what actually happened.

alter table transactions
  add column if not exists liability_id text references liabilities(id) on delete set null;

create index if not exists transactions_liability_date_idx
  on transactions (liability_id, date);
