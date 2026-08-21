-- Marker for the automatic price refresh.
--
-- The refresh needs to know when it last ran so that loading the dashboard can
-- trigger it only when prices are actually stale, instead of on every request
-- or never.

create table if not exists app_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
