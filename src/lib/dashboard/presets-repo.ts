import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  defaultLayoutForKind,
  getTile,
  type TileLayout,
  type TileRow,
} from "@/lib/dashboard/tiles-repo";

/**
 * CRUD for dashboard presets: named collections of pinned tiles. A tile can
 * belong to many presets; each membership row carries its own grid layout.
 * Single-tenant like tiles — no user scoping.
 */

export interface PresetRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/** Thrown for unique-name violations so routes can answer 409. */
export class DuplicatePresetNameError extends Error {
  constructor(name: string) {
    super(`A preset named "${name}" already exists`);
    this.name = "DuplicatePresetNameError";
  }
}

const PG_UNIQUE_VIOLATION = "23505";

export async function listPresets(): Promise<PresetRow[]> {
  const { data, error } = await supabaseAdmin
    .from("dashboard_preset")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listPresets: ${error.message}`);
  return (data ?? []) as PresetRow[];
}

export async function createPreset(name: string): Promise<PresetRow> {
  const { data, error } = await supabaseAdmin
    .from("dashboard_preset")
    .insert({ name })
    .select("*")
    .single();
  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION)
      throw new DuplicatePresetNameError(name);
    throw new Error(`createPreset: ${error.message}`);
  }
  return data as PresetRow;
}

export async function renamePreset(id: string, name: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("dashboard_preset")
    .update({ name })
    .eq("id", id);
  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION)
      throw new DuplicatePresetNameError(name);
    throw new Error(`renamePreset: ${error.message}`);
  }
}

export async function deletePreset(id: string): Promise<void> {
  // FK cascade clears membership rows; tiles themselves are untouched.
  const { error } = await supabaseAdmin
    .from("dashboard_preset")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`deletePreset: ${error.message}`);
}

/** Tiles in a preset, with the membership's per-preset layout substituted. */
export async function listPresetTiles(presetId: string): Promise<TileRow[]> {
  const { data, error } = await supabaseAdmin
    .from("dashboard_preset_tile")
    .select("layout, tile:dashboard_tile(*)")
    .eq("preset_id", presetId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listPresetTiles: ${error.message}`);

  return (data ?? []).flatMap((row) => {
    const { layout, tile } = row as unknown as {
      layout: TileLayout;
      tile: TileRow | null;
    };
    return tile ? [{ ...tile, layout }] : [];
  });
}

export async function addTileToPreset(
  presetId: string,
  tileId: string
): Promise<void> {
  const tile = await getTile(tileId);
  if (!tile) throw new Error(`addTileToPreset: tile ${tileId} not found`);

  // Stack the tile below the preset's existing members.
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("dashboard_preset_tile")
    .select("layout")
    .eq("preset_id", presetId);
  if (exErr) throw new Error(`addTileToPreset (read): ${exErr.message}`);

  const maxY = (existing ?? []).reduce((acc, row) => {
    const l = (row as { layout: TileLayout | null }).layout;
    if (!l) return acc;
    return Math.max(acc, (l.y ?? 0) + (l.h ?? 0));
  }, 0);

  const layout: TileLayout = {
    ...defaultLayoutForKind(tile.spec.kind),
    y: maxY,
  };

  const { error } = await supabaseAdmin
    .from("dashboard_preset_tile")
    .insert({ preset_id: presetId, tile_id: tileId, layout });
  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) return; // already a member — no-op
    throw new Error(`addTileToPreset (insert): ${error.message}`);
  }
}

export async function removeTileFromPreset(
  presetId: string,
  tileId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("dashboard_preset_tile")
    .delete()
    .eq("preset_id", presetId)
    .eq("tile_id", tileId);
  if (error) throw new Error(`removeTileFromPreset: ${error.message}`);
}

export async function updatePresetTileLayout(
  presetId: string,
  tileId: string,
  layout: TileLayout
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("dashboard_preset_tile")
    .update({ layout })
    .eq("preset_id", presetId)
    .eq("tile_id", tileId);
  if (error) throw new Error(`updatePresetTileLayout: ${error.message}`);
}
