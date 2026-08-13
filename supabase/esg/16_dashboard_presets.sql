-- =============================================================================
-- ESG DATA TOOL — AI Dashboard presets
--
-- Named collections of pinned tiles ("Water usage", ...). A tile can belong to
-- many presets; each membership carries its own grid layout so the same chart
-- can be arranged differently per preset. Deleting a preset only removes
-- memberships — tiles live on in the shared "All pins" dashboard.
-- =============================================================================
set search_path = esg, public;

create table if not exists esg.dashboard_preset (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create unique index if not exists dashboard_preset_name_key
    on esg.dashboard_preset (lower(name));

drop trigger if exists dashboard_preset_set_updated_at on esg.dashboard_preset;
create trigger dashboard_preset_set_updated_at
    before update on esg.dashboard_preset
    for each row execute function esg.set_updated_at();

create table if not exists esg.dashboard_preset_tile (
    preset_id   uuid not null references esg.dashboard_preset(id) on delete cascade,
    tile_id     uuid not null references esg.dashboard_tile(id) on delete cascade,
    layout      jsonb not null,                 -- per-preset { x, y, w, h }
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    primary key (preset_id, tile_id)
);

create index if not exists dashboard_preset_tile_tile_idx
    on esg.dashboard_preset_tile (tile_id);

drop trigger if exists dashboard_preset_tile_set_updated_at on esg.dashboard_preset_tile;
create trigger dashboard_preset_tile_set_updated_at
    before update on esg.dashboard_preset_tile
    for each row execute function esg.set_updated_at();

-- Make the new tables reachable by the API role (default privileges should
-- already cover this, but be explicit like the dashboard_tile setup was).
grant select, insert, update, delete on esg.dashboard_preset to service_role;
grant select, insert, update, delete on esg.dashboard_preset_tile to service_role;

notify pgrst, 'reload schema';
