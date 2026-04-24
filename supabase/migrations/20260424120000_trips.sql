-- Trips: country transitions per person (see docs/SPEC.md)

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  person text not null check (person in ('simon', 'chiara')),
  departure_country text not null,
  arrival_country text not null,
  depart_date date not null,
  arrive_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by text not null check (created_by in ('simon', 'chiara')),
  constraint trips_arrive_after_depart check (arrive_date >= depart_date)
);

create index trips_person_depart_date_idx on public.trips (person, depart_date);

alter table public.trips enable row level security;

-- Shared household data: any authenticated Supabase user may read and write all rows.
-- The Edge Function uses the service role and bypasses RLS.
create policy "trips_select_household"
  on public.trips
  for select
  to authenticated
  using (true);

create policy "trips_insert_household"
  on public.trips
  for insert
  to authenticated
  with check (true);

create policy "trips_update_household"
  on public.trips
  for update
  to authenticated
  using (true)
  with check (true);

create policy "trips_delete_household"
  on public.trips
  for delete
  to authenticated
  using (true);
