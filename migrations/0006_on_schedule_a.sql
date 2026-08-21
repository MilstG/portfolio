-- Payment schedule for ON bonds (DetallePagos.xlsx) part A
-- Depends on 0005 bond assets

-- Clear previous import txs/recurring for these bonds (re-run safe)
delete from transactions where asset_id in (select id from assets where ticker in ('CICAO','GYC5O','HJCIO','IRCPO','MCC1O','MCC3O','MGCRO','OT42O','PLC3O','PLC4O','VSCVO','ZZC1O') and id like 'bond-%');
delete from recurring_incomes where asset_id in (select id from assets where ticker in ('CICAO','GYC5O','HJCIO','IRCPO','MCC1O','MCC3O','MGCRO','OT42O','PLC3O','PLC4O','VSCVO','ZZC1O') and id like 'bond-%');

-- Full coupon + amortization schedule as dated transactions
insert into transactions (id, date, description, amount, currency, type, category, asset_id)
values ('pay-gyc5o-2026-09-05-renta', '2026-09-05', 'Cupón GYC5O', 214.086, 'USD', 'COUPON', 'Bonds', 'bond-gyc5o')
on conflict (id) do update set amount = excluded.amount, description = excluded.description;

insert into transactions (id, date, description, amount, currency, type, category, asset_id)
values ('pay-mcc1o-2026-09-10-renta', '2026-09-10', 'Cupón MCC1O', 398.247, 'USD', 'COUPON', 'Bonds', 'bond-mcc1o')
on conflict (id) do update set amount = excluded.amount, description = excluded.description;

insert into transactions (id, date, description, amount, currency, type, category, asset_id)
values ('pay-ircpo-2026-09-30-renta', '2026-09-30', 'Cupón IRCPO', 839.88, 'USD', 'COUPON', 'Bonds', 'bond-ircpo')
on conflict (id) do update set amount = excluded.amount, description = excluded.description;

insert into transactions (id, date, description, amount, currency, type, category, asset_id)
values ('pay-ot42o-2026-10-17-renta', '2026-10-17', 'Cupón OT42O', 201.644, 'USD', 'COUPON', 'Bonds', 'bond-ot42o')
on conflict (id) do update set amount = excluded.amount, description = excluded.description;

insert into transactions (id, date, description, amount, currency, type, category, asset_id)
values ('pay-mcc3o-2026-11-11-renta', '2026-11-11', 'Cupón MCC3O', 378.082, 'USD', 'COUPON', 'Bonds', 'bond-mcc3o')
on conflict (id) do update set amount = excluded.amount, description = excluded.description;

insert into transactions (id, date, description, amount, currency, type, category, asset_id)
values ('pay-mgcro-2026-11-14-renta', '2026-11-14', 'Cupón MGCRO', 387.5, 'USD', 'COUPON', 'Bonds', 'bond-mgcro')
on conflict (id) do update set amount = excluded.amount, description = excluded.description;

insert into transactions (id, date, description, amount, currency, type, category, asset_id)
values ('pay-hjcio-2026-11-27-renta', '2026-11-27', 'Cupón HJCIO', 378.082, 'USD', 'COUPON', 'Bonds', 'bond-hjcio')
on conflict (id) do update set amount = excluded.amount, description = excluded.description;

insert into transactions (id, date, description, amount, currency, type, category, asset_id)
values ('pay-plc4o-2026-11-30-renta', '2026-11-30', 'Cupón PLC4O', 425.0, 'USD', 'COUPON', 'Bonds', 'bond-plc4o')
on conflict (id) do update set amount = excluded.amount, description = excluded.description;

insert into transactions (id, date, description, amount, currency, type, category, asset_id)
values ('pay-cicao-2026-12-03-renta', '2026-12-03', 'Cupón CICAO', 401.096, 'USD', 'COUPON', 'Bonds', 'bond-cicao')
on conflict (id) do update set amount = excluded.amount, description = excluded.description;

insert into transactions (id, date, description, amount, currency, type, category, asset_id)
values ('pay-gyc5o-2026-12-05-renta', '2026-12-05', 'Cupón GYC5O', 211.759, 'USD', 'COUPON', 'Bonds', 'bond-gyc5o')
on conflict (id) do update set amount = excluded.amount, description = excluded.description;

insert into transactions (id, date, description, amount, currency, type, category, asset_id)
values ('pay-vscvo-2026-12-10-renta', '2026-12-10', 'Cupón VSCVO', 425.0, 'USD', 'COUPON', 'Bonds', 'bond-vscvo')
on conflict (id) do update set amount = excluded.amount, description = excluded.description;
