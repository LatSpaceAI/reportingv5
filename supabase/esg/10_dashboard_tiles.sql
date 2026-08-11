-- =============================================================================
-- ESG DATA TOOL — AI Dashboard tile persistence
--
-- Stores charts the user "pins" from the AI Dashboard. Single-tenant (plato-v1
-- has no auth), so there's no user_id / dashboard owner — every tile belongs to
-- the one shared dashboard. Each tile stores a validated ChartSpec (jsonb) plus
-- a grid layout; data is re-fetched live, never snapshotted.
-- =============================================================================
set search_path = esg, public;

-- Shared trigger fn to maintain updated_at (created here; idempotent).
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
    spec        jsonb not null,                 -- validated ChartSpec
    layout      jsonb not null,                 -- { x, y, w, h } for react-grid-layout
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists dashboard_tile_created_idx
    on esg.dashboard_tile (created_at);

drop trigger if exists dashboard_tile_set_updated_at on esg.dashboard_tile;
create trigger dashboard_tile_set_updated_at
    before update on esg.dashboard_tile
    for each row execute function esg.set_updated_at();
