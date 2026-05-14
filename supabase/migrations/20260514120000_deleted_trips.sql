-- Archive table for soft-deleted trips. delete_trip moves rows here; restore_trip moves them back.

create table public.deleted_trips (
  id uuid primary key,
  person text not null check (person in ('simon', 'chiara')),
  departure_country text not null,
  arrival_country text not null,
  depart_date date not null,
  arrive_date date not null,
  notes text,
  created_at timestamptz,
  created_by text,
  deleted_by text not null check (deleted_by in ('simon', 'chiara')),
  deleted_at timestamptz not null default now()
);

alter table public.deleted_trips enable row level security;

create policy "deleted_trips_select_household"
  on public.deleted_trips
  for select
  to authenticated
  using (true);

create policy "deleted_trips_insert_household"
  on public.deleted_trips
  for insert
  to authenticated
  with check (true);

create policy "deleted_trips_delete_household"
  on public.deleted_trips
  for delete
  to authenticated
  using (true);
