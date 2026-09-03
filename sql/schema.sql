-- =====================================================================
-- WINTER ARC — Supabase schema
-- Paste this whole file into Supabase -> SQL Editor -> Run.
-- One row per person per day. Tasks live in a JSONB blob:
--   { "gym": "done", "run": "miss", "water": "done" }
-- The day's food is a single block of free text.
-- =====================================================================

create table if not exists public.winter_arc_days (
  user_id    text        not null,
  day        date        not null,
  tasks      jsonb       not null default '{}'::jsonb,
  food       text        not null default '',
  note       text        not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists winter_arc_days_user_idx on public.winter_arc_days (user_id);

-- Already ran an earlier version of this file? This adds the food column
-- without touching existing rows. (An unused 'meals' column from an even
-- earlier version is harmless; drop it by hand if you want it gone.)
alter table public.winter_arc_days
  add column if not exists food text not null default '';

alter table public.winter_arc_days enable row level security;

-- ---------------------------------------------------------------------
-- Policies.
--
-- This app has no Supabase Auth users — it gates on a passcode in
-- config.js — so the browser talks to Supabase with the anon key.
-- These policies let the anon key read and write ONLY this table.
--
-- Read this honestly: anyone who views the page source can find the
-- anon key and could, in theory, edit your two rows. For a private
-- habit tracker between two friends that is a fine trade. Do not put
-- anything sensitive in the note field.
-- ---------------------------------------------------------------------

drop policy if exists "winter arc read"   on public.winter_arc_days;
drop policy if exists "winter arc insert" on public.winter_arc_days;
drop policy if exists "winter arc update" on public.winter_arc_days;

create policy "winter arc read"
  on public.winter_arc_days for select
  to anon, authenticated
  using (true);

create policy "winter arc insert"
  on public.winter_arc_days for insert
  to anon, authenticated
  with check (user_id in ('sarthak', 'inan'));

create policy "winter arc update"
  on public.winter_arc_days for update
  to anon, authenticated
  using (user_id in ('sarthak', 'inan'))
  with check (user_id in ('sarthak', 'inan'));

-- Deliberately NO delete policy: nothing can be wiped from the browser.
