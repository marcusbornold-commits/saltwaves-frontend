-- Aktivitetslogg för Sjöberg-portalen + summering av lagringsanvändning (bara service role). Additiv.
create table if not exists public.sjoberg_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  who text not null,
  action text not null check (action in ('login','upload','master_start','chapter_saved','download_zip','report','delete','producer_upload')),
  book_id uuid,
  chapter_id uuid,
  detail jsonb
);
create index if not exists sjoberg_events_at_idx on public.sjoberg_events (at desc);
alter table public.sjoberg_events enable row level security;
revoke all on public.sjoberg_events from anon, authenticated;

create or replace function public.sjoberg_storage_bytes()
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint from storage.objects
$$;
revoke all on function public.sjoberg_storage_bytes() from public, anon, authenticated;
grant execute on function public.sjoberg_storage_bytes() to service_role;
