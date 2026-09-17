-- Distans B2B private demo links (Saltwaves/PodMaster Supabase only — never Earselect).
-- Applied on project foxohcrjubrregfjfznl (Satwaves.studo / Saltwaves).

create table if not exists public.distans_demo_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  prospect_id text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  first_upload_at timestamptz,
  constraint distans_demo_links_token_len check (char_length(token) >= 16 and char_length(token) <= 128)
);

create index if not exists distans_demo_links_active_idx
  on public.distans_demo_links (active) where active = true;

alter table public.distans_demo_links enable row level security;
revoke all on public.distans_demo_links from anon, authenticated;
grant select, insert, update on public.distans_demo_links to service_role;

-- Allow Distans demo attribution on existing PodMaster upload_events.tool check.
alter table public.upload_events drop constraint if exists upload_events_tool_check;
alter table public.upload_events
  add constraint upload_events_tool_check
  check (tool = any (array[
    'podmaster'::text,
    'audioform'::text,
    'loudness_inspector'::text,
    'distans_demo'::text
  ]));
