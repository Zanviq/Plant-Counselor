-- 003_calendar_event_color.sql
-- Add a user-selected palette color to standalone calendar events.
--
-- Apply once through /admin/controller -> SQL executor or the
-- exec_admin_query RPC. Existing rows keep the previous olive accent.

alter table public.calendar_events
  add column if not exists color text not null default 'olive';

alter table public.calendar_events
  drop constraint if exists calendar_events_color_check;

alter table public.calendar_events
  add constraint calendar_events_color_check
  check (color in ('olive', 'blue', 'yellow', 'red', 'pink', 'purple'));

notify pgrst, 'reload schema';
