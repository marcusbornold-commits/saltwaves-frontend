-- Sjöberg förlag, portal v1 (30 dagars test): böcker, kapitel och producentlänkar.
-- Endast service role (Next.js-servern på Mac Minin). RLS på utan policies => anon/authenticated når ingenting.
create table if not exists public.sjoberg_books (
  id uuid primary key default gen_random_uuid(),
  tenant text not null default 'sjoberg',
  title text not null check (char_length(title) between 1 and 200),
  narrator text not null default '' check (char_length(narrator) <= 200),
  isbn text check (isbn is null or char_length(isbn) <= 32),
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  expires_at timestamptz
);
create table if not exists public.sjoberg_upload_links (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.sjoberg_books(id) on delete cascade,
  token_hash text not null unique,
  label text not null default '' check (char_length(label) <= 120),
  expires_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.sjoberg_chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.sjoberg_books(id) on delete cascade,
  number int not null check (number between 0 and 9999),
  name text not null check (char_length(name) between 1 and 200),
  original_filename text not null default '',
  source text not null check (source in ('sjoberg','producer')),
  link_id uuid references public.sjoberg_upload_links(id) on delete set null,
  status text not null default 'uploaded' check (status in ('uploaded','processing','approved','rejected','failed')),
  backend_upload text,
  backend_job text,
  storage_path text,
  checks jsonb,
  duration_s double precision,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sjoberg_chapters_book_idx on public.sjoberg_chapters(book_id, number);
create index if not exists sjoberg_links_book_idx on public.sjoberg_upload_links(book_id);
alter table public.sjoberg_books enable row level security;
alter table public.sjoberg_upload_links enable row level security;
alter table public.sjoberg_chapters enable row level security;
revoke all on public.sjoberg_books, public.sjoberg_upload_links, public.sjoberg_chapters from anon, authenticated;
comment on table public.sjoberg_books is 'Sjöberg portal v1: books. Service-role only. Files kept 30 days after delivery (expires_at).';
comment on table public.sjoberg_upload_links is 'Sjöberg portal v1: producer upload links (sha256 token hash). Service-role only.';
comment on table public.sjoberg_chapters is 'Sjöberg portal v1: chapters, status and spec checks. Files in audiobook-private/sjoberg-portal/. Service-role only.';
