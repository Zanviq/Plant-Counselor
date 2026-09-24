"""Initial schema for self-hosted PostgreSQL 16.

Restored from the application's queries plus the former SQL migrations
001–006 (calendar events, ai_logs, colors, bud default status, event time,
end date/repeat), folded into one baseline.

Changes compared with the former hosted setup:
  - `users` replaces the former `profiles` table plus the provider's auth
    table: it now holds the login credentials (username + bcrypt hash) too.
  - Foreign keys point at `users(id)` instead of the provider's auth schema.
  - Row-level security is not used. The policies below are enforced in the
    backend instead (every repository query filters by the session user id,
    admin routes require role = 'admin'):
        calendar_events_owner: USING/WITH CHECK (auth.uid() = user_id)
            → app/repositories/calendar_event_repo.py (user_id in every WHERE)
        ai_logs: RLS enabled with no policies (no direct client access)
            → only app/routers/admin.py (require_admin) reads ai_logs

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-09-24
"""
from alembic import op

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


UPGRADE_SQL = r"""
-- ── helpers ────────────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  -- Refresh on every update unless the statement set updated_at explicitly.
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end $$;

-- ── users ──────────────────────────────────────────────────────────────────
create table users (
  id             text primary key,
  username       text not null unique,
  password_hash  text not null,
  email          text,
  nickname       text,
  role           text not null default 'user' check (role in ('user', 'admin')),
  tone           text not null default 'counselor',
  -- NULL = follow the runtime default model (admin controller)
  ai_model       text,
  garden_rules   jsonb not null default
                 '{"wilting_days": 7, "rot_disappear_days": 14, "deadline_warn_days": 3, "auto_transition": true}'::jsonb,
  appearance     jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger users_updated_at before update on users
  for each row execute function set_updated_at();

-- ── plants ─────────────────────────────────────────────────────────────────
create table plants (
  id                text primary key,
  user_id           text not null references users(id) on delete cascade,
  name              text not null,
  description       text not null default '',
  species           text not null default 'tree_oak',
  color             text not null default 'brand.primary_leaf',
  -- active / wilting / dormant / archived
  status            text not null default 'active',
  stats             jsonb not null default '{}'::jsonb,
  last_activity_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index plants_user_status_idx on plants (user_id, status);
create index plants_user_activity_idx on plants (user_id, last_activity_at);
create trigger plants_updated_at before update on plants
  for each row execute function set_updated_at();

-- ── buds ───────────────────────────────────────────────────────────────────
create table buds (
  id                text primary key,
  user_id           text not null references users(id) on delete cascade,
  plant_id          text not null references plants(id) on delete cascade,
  title             text not null,
  detail            text not null default '',
  -- concern / schedule
  type              text not null default 'concern',
  -- bud / flower / fruit / harvested / wilting / rot
  status            text not null default 'bud',
  progress          integer not null default 0 check (progress between 0 and 100),
  deadline          date,
  last_progress_at  timestamptz,
  disappeared_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index buds_user_status_idx on buds (user_id, status);
create index buds_user_deadline_idx on buds (user_id, deadline);
create index buds_plant_status_idx on buds (plant_id, status);
create trigger buds_updated_at before update on buds
  for each row execute function set_updated_at();

create table bud_history (
  id           text primary key,
  bud_id       text not null references buds(id) on delete cascade,
  from_status  text not null default '',
  to_status    text not null,
  at           timestamptz not null default now(),
  reason       text not null default ''
);
create index bud_history_bud_at_idx on bud_history (bud_id, at);

-- ── garden_state ───────────────────────────────────────────────────────────
create table garden_state (
  id                   text primary key,
  user_id              text not null unique references users(id) on delete cascade,
  summary_cache        jsonb not null default '{}'::jsonb,
  daily_briefing       text,
  daily_briefing_date  date,
  last_opened_at       timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger garden_state_updated_at before update on garden_state
  for each row execute function set_updated_at();

-- ── conversations ──────────────────────────────────────────────────────────
create table conversations (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  -- global / plant / bud / calendar
  scope       text not null default 'global',
  scope_id    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint conversations_user_scope_key unique nulls not distinct (user_id, scope, scope_id)
);
create trigger conversations_updated_at before update on conversations
  for each row execute function set_updated_at();

create table conversation_messages (
  id               text primary key,
  conversation_id  text not null references conversations(id) on delete cascade,
  at               timestamptz not null default now(),
  role             text not null,
  text             text not null,
  skill_call       jsonb
);
create index conversation_messages_conv_at_idx on conversation_messages (conversation_id, at);

-- A new message marks its conversation as recently active (history ordering).
create or replace function touch_conversation() returns trigger
language plpgsql as $$
begin
  update conversations set updated_at = now() where id = new.conversation_id;
  return new;
end $$;
create trigger conversation_messages_touch after insert on conversation_messages
  for each row execute function touch_conversation();

-- ── notifications ──────────────────────────────────────────────────────────
create table notifications (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  acked_at    timestamptz
);
create index notifications_user_acked_idx on notifications (user_id, acked_at);

-- ── ai_logs ────────────────────────────────────────────────────────────────
create table ai_logs (
  filename    text primary key,      -- e.g. 20260601_131617_337266_abcdef12.json
  user_id     text,
  created_at  timestamptz not null default now(),
  data        jsonb not null         -- system prompt, llm_calls, skills, events, errors
);
create index ai_logs_user_id_idx on ai_logs (user_id);
create index ai_logs_filename_idx on ai_logs (filename desc);

-- ── calendar_events (standalone events, not buds) ──────────────────────────
create table calendar_events (
  id           text primary key,
  user_id      text not null references users(id) on delete cascade,
  plant_id     text references plants(id) on delete cascade,
  title        text not null,
  detail       text default '',
  event_date   date not null,
  event_time   time,
  end_date     date not null,
  end_time     time,
  all_day      boolean not null default true,
  repeat_rule  text not null default 'none',
  color        text not null default 'olive',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  constraint calendar_events_color_check
    check (color in ('olive', 'blue', 'yellow', 'red', 'pink', 'purple')),
  constraint calendar_events_repeat_rule_check
    check (repeat_rule in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  constraint calendar_events_time_check check (
    end_date >= event_date
    and (
      (all_day = true and event_time is null and end_time is null)
      or (
        all_day = false
        and event_time is not null
        and end_time is not null
        and (end_date > event_date or end_time > event_time)
      )
    )
  )
);
create index calendar_events_user_date_idx on calendar_events (user_id, event_date);
create index calendar_events_plant_idx on calendar_events (plant_id);
create index calendar_events_user_date_time_idx on calendar_events (user_id, event_date, all_day, event_time);
create index calendar_events_user_repeat_range_idx on calendar_events (user_id, repeat_rule, event_date, end_date);
"""

DOWNGRADE_SQL = r"""
drop table if exists calendar_events;
drop table if exists ai_logs;
drop table if exists notifications;
drop table if exists conversation_messages;
drop table if exists conversations;
drop table if exists garden_state;
drop table if exists bud_history;
drop table if exists buds;
drop table if exists plants;
drop table if exists users;
drop function if exists touch_conversation();
drop function if exists set_updated_at();
"""


def _run_script(script: str) -> None:
    # Send the multi-statement script through the raw psycopg connection with no
    # bind parameters, so it uses the simple query protocol ($$ bodies and
    # ::casts are passed through untouched).
    op.get_bind().connection.driver_connection.execute(script)


def upgrade() -> None:
    _run_script(UPGRADE_SQL)


def downgrade() -> None:
    _run_script(DOWNGRADE_SQL)
