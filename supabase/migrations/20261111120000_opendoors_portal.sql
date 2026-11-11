-- Open Doors portal v1: episodes, tracks, events. Service-role only.
-- Does not touch sjoberg_* tables.
create table if not exists public.opendoors_episodes (
  id uuid primary key default gen_random_uuid(),
  tenant text not null default 'opendoors',
  title text not null check (char_length(title) between 1 and 200),
  show_name text not null default 'Motljus' check (char_length(show_name) between 1 and 200),
  status text not null default 'draft' check (status in ('draft','uploading','processing','done','failed')),
  notify_email text,
  backend_job text,
  storage_path_wav text,
  storage_path_mp3 text,
  storage_path_raw text,
  analysis jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  expires_at timestamptz
);
create table if not exists public.opendoors_tracks (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.opendoors_episodes(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  original_filename text not null default '' check (char_length(original_filename) <= 255),
  mic_type text not null default 'dynamic' check (mic_type in ('dynamic','condenser','headset')),
  is_room boolean not null default false,
  sort_order int not null default 0,
  tus_path text,
  storage_path text,
  duration_s double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.opendoors_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  who text not null default '' check (char_length(who) <= 120),
  action text not null check (char_length(action) <= 80),
  episode_id uuid references public.opendoors_episodes(id) on delete set null,
  detail jsonb
);
create index if not exists opendoors_episodes_created_idx on public.opendoors_episodes (created_at desc);
create index if not exists opendoors_tracks_episode_idx on public.opendoors_tracks (episode_id, sort_order);
create index if not exists opendoors_events_at_idx on public.opendoors_events (at desc);
create index if not exists opendoors_events_episode_idx on public.opendoors_events (episode_id);
alter table public.opendoors_episodes enable row level security;
alter table public.opendoors_tracks enable row level security;
alter table public.opendoors_events enable row level security;
revoke all on public.opendoors_episodes, public.opendoors_tracks, public.opendoors_events from anon, authenticated;
comment on table public.opendoors_episodes is 'Open Doors portal v1: episodes. Service-role only. Files kept 30 days after delivery (expires_at).';
comment on table public.opendoors_tracks is 'Open Doors portal v1: one row per mic/speaker track. Service-role only. Files in audiobook-private/opendoors-portal/.';
comment on table public.opendoors_events is 'Open Doors portal v1: activity log. Service-role only.';
