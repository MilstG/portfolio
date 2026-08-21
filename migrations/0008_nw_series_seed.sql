-- Seed NW series from ON purchase day so chart is never empty.
-- Cost basis of the 12 ONs = 120069. Demo assets still in seed are included roughly;
-- subsequent daily loads will overwrite today with live netWorthUsd().

insert into snapshots (date, total_usd) values
  ('2026-08-20', 120069),
  ('2026-08-21', 139806)
on conflict (date) do update set total_usd = excluded.total_usd;
