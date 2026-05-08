create table public.apn_health_records (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  created_at timestamptz not null default now(),
  symptoms jsonb not null default '[]'::jsonb,
  duration text,
  intensity int,
  history jsonb not null default '[]'::jsonb,
  medications jsonb not null default '[]'::jsonb,
  allergies jsonb not null default '[]'::jsonb,
  red_flags jsonb not null default '[]'::jsonb,
  raw_text text
);
create index apn_health_records_session_idx on public.apn_health_records (session_id, created_at desc);
alter table public.apn_health_records enable row level security;
create policy "anyone can read apn_health_records"
  on public.apn_health_records for select using (true);
create policy "anyone can insert apn_health_records"
  on public.apn_health_records for insert with check (true);