-- DEUCEY — core schema
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.

create extension if not exists postgis;

-- =========================================================
-- profiles: one row per auth.users row.
-- Real name/email live only in auth.users (managed by Supabase Auth).
-- Everything here is what OTHER players are allowed to see, so keep it anonymous:
-- a handle, a skill level, a rough location — never real name/email/phone.
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (char_length(handle) between 3 and 24),
  skill_level numeric(2,1) check (skill_level between 1.0 and 7.0), -- NTRP-style self rating
  bio text check (char_length(bio) <= 280),
  home_location geography(Point, 4326),
  city text,
  search_radius_km numeric default 15 check (search_radius_km > 0),
  is_looking_for_match boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_home_location_idx on public.profiles using gist (home_location);

alter table public.profiles enable row level security;

-- A user can always see and edit their own full row.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Other users never query this table directly for each other — they go through
-- the public_players view / nearby_players() function below, which expose only
-- handle + skill_level + distance, never home_location or any auth identity.

-- =========================================================
-- courts: public + private tennis courts. Readable by anyone (even signed out),
-- so people can see where courts are before creating an account.
-- =========================================================
create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  location geography(Point, 4326) not null,
  court_type text not null default 'unknown' check (court_type in ('public', 'private', 'unknown')),
  surface text check (surface in ('hard', 'clay', 'grass', 'unknown')) default 'unknown',
  num_courts int not null default 1 check (num_courts > 0),
  lit boolean not null default false,
  notes text,
  source text not null default 'manual',
  external_id text, -- e.g. OSM way id, for de-duping re-imports
  verified boolean not null default false, -- has a human confirmed name/type/address?
  created_at timestamptz not null default now()
);

create unique index if not exists courts_source_external_id_idx on public.courts (source, external_id) where external_id is not null;
create index if not exists courts_location_idx on public.courts using gist (location);

alter table public.courts enable row level security;

drop policy if exists "courts: readable by everyone" on public.courts;
create policy "courts: readable by everyone"
  on public.courts for select
  using (true);

-- Only service_role (the seed script / an admin tool) can write for now.
-- No insert/update/delete policy is defined for anon/authenticated, so RLS
-- denies those by default until a "suggest a court" feature adds one.

-- =========================================================
-- public_players: safe, anonymous view of players opted in to matching.
-- Never exposes home_location directly — distance is computed server-side
-- in nearby_players() instead.
-- =========================================================
create or replace view public.public_players
  with (security_invoker = true)
  as
  select id, handle, skill_level, city
  from public.profiles
  where is_looking_for_match = true;

grant select on public.public_players to authenticated;

-- =========================================================
-- nearby_courts: courts within radius_km of a given point, closest first.
-- =========================================================
-- Adding max_results changed the signature — drop the old 3-arg overload first
-- so a re-run doesn't leave both versions around (which would make plain
-- 3-argument calls ambiguous or silently keep hitting the un-limited old one).
drop function if exists public.nearby_courts(double precision, double precision, double precision);

create or replace function public.nearby_courts(
  lat double precision,
  lon double precision,
  radius_km double precision default 15,
  max_results int default 200
)
returns table (
  id uuid,
  name text,
  address text,
  latitude double precision,
  longitude double precision,
  court_type text,
  surface text,
  num_courts int,
  lit boolean,
  distance_km double precision
)
language sql
stable
as $$
  select
    c.id,
    c.name,
    c.address,
    st_y(c.location::geometry) as latitude,
    st_x(c.location::geometry) as longitude,
    c.court_type,
    c.surface,
    c.num_courts,
    c.lit,
    st_distance(c.location, st_makepoint(lon, lat)::geography) / 1000.0 as distance_km
  from public.courts c
  where st_dwithin(c.location, st_makepoint(lon, lat)::geography, radius_km * 1000)
  order by distance_km asc
  limit least(greatest(max_results, 1), 500);
$$;

grant execute on function public.nearby_courts(double precision, double precision, double precision, int) to anon, authenticated;

-- =========================================================
-- nearby_courts_for_me: convenience wrapper around nearby_courts() that uses
-- the signed-in caller's own home_location, so the client never has to read
-- or pass raw lat/lng around.
-- =========================================================
create or replace function public.nearby_courts_for_me(radius_km double precision default null)
returns table (
  id uuid,
  name text,
  address text,
  latitude double precision,
  longitude double precision,
  court_type text,
  surface text,
  num_courts int,
  lit boolean,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select nc.*
  from public.profiles me
  cross join lateral public.nearby_courts(
    st_y(me.home_location::geometry),
    st_x(me.home_location::geometry),
    coalesce(radius_km, me.search_radius_km, 15)
  ) nc
  where me.id = auth.uid()
    and me.home_location is not null;
$$;

grant execute on function public.nearby_courts_for_me(double precision) to authenticated;

-- =========================================================
-- nearby_players: other opted-in players within the CALLER's own search
-- radius, closest first. Reads the caller's home_location server-side —
-- never returns anyone's raw location, only a rounded distance.
-- =========================================================
create or replace function public.nearby_players()
returns table (
  id uuid,
  handle text,
  skill_level numeric,
  city text,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.handle,
    p.skill_level,
    p.city,
    st_distance(p.home_location, me.home_location) / 1000.0 as distance_km
  from public.profiles p
  join public.profiles me on me.id = auth.uid()
  where p.is_looking_for_match = true
    and me.is_looking_for_match = true
    and p.id <> me.id
    and me.home_location is not null
    and p.home_location is not null
    and st_dwithin(p.home_location, me.home_location, coalesce(me.search_radius_km, 15) * 1000)
  order by distance_km asc;
$$;

grant execute on function public.nearby_players() to authenticated;
