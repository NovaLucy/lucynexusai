create table public.apn_memory (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_msg text not null,
  apn_msg text not null,
  intent jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  session_id text not null
);

create index apn_memory_session_idx on public.apn_memory (session_id, created_at desc);

alter table public.apn_memory enable row level security;

-- V1 sans authentification : la m\u00e9moire est isol\u00e9e par session_id c\u00f4t\u00e9 client.
create policy "anyone can read apn_memory"
  on public.apn_memory for select
  using (true);

create policy "anyone can insert apn_memory"
  on public.apn_memory for insert
  with check (true);