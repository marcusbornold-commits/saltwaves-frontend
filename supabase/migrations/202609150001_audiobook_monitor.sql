-- Dedicated Audiobook project only: xuxqrkposxrvhwvwjroc.
create table if not exists public.audiobook_monitor_health (
 id text primary key, checked_at timestamptz not null default now(), data jsonb not null
);
create table if not exists public.audiobook_monitor_state (
 id text primary key, failures int not null default 0, successes int not null default 0,
 incident uuid, checked_at timestamptz, check_id text, issues text[] not null default '{}'
);
create table if not exists public.audiobook_monitor_notifications (
 id uuid primary key default gen_random_uuid(), incident uuid not null, kind text not null,
 created_at timestamptz not null default now(), issues text[] not null, sent_at timestamptz,
 unique(incident,kind)
);
alter table public.audiobook_monitor_health enable row level security;
alter table public.audiobook_monitor_state enable row level security;
alter table public.audiobook_monitor_notifications enable row level security;
revoke all on public.audiobook_monitor_health, public.audiobook_monitor_state, public.audiobook_monitor_notifications from anon, authenticated;
grant select,insert,update on public.audiobook_monitor_health, public.audiobook_monitor_state, public.audiobook_monitor_notifications to service_role;
create or replace function public.record_audiobook_monitor(p_issues text[], p_check_id text)
returns void language plpgsql security invoker set search_path=public as $$
declare s public.audiobook_monitor_state;
begin
 insert into audiobook_monitor_state(id) values('main') on conflict do nothing;
 select * into s from audiobook_monitor_state where id='main' for update;
 if s.check_id=p_check_id then return; end if;
 if cardinality(p_issues)>0 then
  s.failures:=s.failures+1; s.successes:=0;
  if s.failures>=3 and s.incident is null then
   s.incident:=gen_random_uuid();
   insert into audiobook_monitor_notifications(incident,kind,issues) values(s.incident,'outage',p_issues);
  end if;
 else
  s.successes:=s.successes+1; s.failures:=0;
  if s.successes>=2 and s.incident is not null then
   insert into audiobook_monitor_notifications(incident,kind,issues) values(s.incident,'recovery',s.issues);
   s.incident:=null;
  end if;
 end if;
 update audiobook_monitor_state set failures=s.failures,successes=s.successes,incident=s.incident,checked_at=now(),check_id=p_check_id,
 issues=case when cardinality(p_issues)>0 then p_issues when s.incident is not null then s.issues else '{}'::text[] end where id='main';
end $$;
revoke all on function public.record_audiobook_monitor(text[],text) from public,anon,authenticated;
grant execute on function public.record_audiobook_monitor(text[],text) to service_role;
