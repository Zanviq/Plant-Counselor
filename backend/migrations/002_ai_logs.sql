-- 002_ai_logs.sql
-- Durable storage for AI chat logs (admin "AI 로그" page).
--
-- Why: logs used to live only as JSON files in backend/logs/chat/. On hosts with
-- an ephemeral disk (Render free tier) that directory is wiped on restart, so the
-- admin AI log page went empty after a day. This table makes logs survive restarts.
--
-- How to apply: paste this whole file into /admin/controller → SQL 실행기 and run it
-- once. (Supabase exposes only migration-tool DDL to PostgREST, so the app reads/
-- writes this table through the service_role key via app/ai/log_store.py.)

create table if not exists public.ai_logs (
    filename   text primary key,           -- e.g. 20260601_131617_337266_abcdef12.json
    user_id    text,
    created_at timestamptz not null default now(),
    data       jsonb not null              -- full log payload (system prompt, llm_calls, skills, events, errors)
);

create index if not exists ai_logs_user_id_idx  on public.ai_logs (user_id);
create index if not exists ai_logs_filename_idx on public.ai_logs (filename desc);

-- Backend uses the service_role key (bypasses RLS). Enabling RLS with no policies
-- prevents anon/authenticated clients from reading logs directly via PostgREST.
alter table public.ai_logs enable row level security;
