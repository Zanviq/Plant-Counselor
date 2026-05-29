-- Migration: calendar_events
-- Standalone calendar schedule entries that are NOT buds (no lifecycle, no garden
-- presence). Lets the calendar screen add plain events without forcing a bud.
--
-- Applied 2026-05-30 via the exec_admin_query RPC (service role). Kept here for
-- reproducibility. NOTE: a freshly-created table is not auto-exposed through
-- Supabase PostgREST's schema cache, so the backend accesses this table via the
-- exec_admin_query RPC (see app/repositories/calendar_event_repo.py) rather than
-- db.table(). If you later re-apply this through Supabase's migration tooling
-- (which reloads PostgREST), the repo can be switched to the normal PostgREST API.

create table if not exists public.calendar_events (
  id          text primary key,
  user_id     text not null,
  plant_id    text references public.plants(id) on delete cascade,
  title       text not null,
  detail      text default '',
  event_date  date not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_calendar_events_user_date
  on public.calendar_events (user_id, event_date);

create index if not exists idx_calendar_events_plant
  on public.calendar_events (plant_id);

alter table public.calendar_events enable row level security;

drop policy if exists calendar_events_owner on public.calendar_events;
create policy calendar_events_owner on public.calendar_events
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

notify pgrst, 'reload schema';
