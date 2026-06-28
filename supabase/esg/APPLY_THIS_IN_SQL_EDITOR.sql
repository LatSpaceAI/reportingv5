-- =============================================================================
-- Run this ONCE in Supabase → SQL Editor to finish AI Dashboard setup.
-- It (1) grants the esg schema to the API roles (fixes the 403), then
-- (2) creates esg.dashboard_tile (fixes the 404), then (3) reloads PostgREST.
--
-- Prereq: Settings → API → Exposed schemas must include `esg` (you said it is).
-- =============================================================================

-- (1) Grants — without these the service_role can't read the esg schema even
--     when it's exposed.  (This also makes the existing /api/esg/health pass.)
grant usage on schema esg to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema esg to service_role;
grant select on all tables in schema esg to anon, authenticated;
grant usage, select on all sequences in schema esg to service_role;
alter default privileges in schema esg
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema esg
  grant select on tables to anon, authenticated;

-- (2) Tile persistence table (same as supabase/esg/09_dashboard_tiles.sql).
set search_path = esg, public;

create or replace function esg.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists esg.dashboard_tile (
    id          uuid primary key default gen_random_uuid(),
    title       text not null default '',
    spec        jsonb not null,
    layout      jsonb not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists dashboard_tile_created_idx
    on esg.dashboard_tile (created_at);

drop trigger if exists dashboard_tile_set_updated_at on esg.dashboard_tile;
create trigger dashboard_tile_set_updated_at
    before update on esg.dashboard_tile
    for each row execute function esg.set_updated_at();

-- Make the new table reachable by service_role too.
grant select, insert, update, delete on esg.dashboard_tile to service_role;

-- (3) Reload PostgREST's schema cache so the new grants/table take effect now.
notify pgrst, 'reload schema';
