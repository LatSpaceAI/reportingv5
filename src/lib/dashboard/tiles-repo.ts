import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ChartSpec } from "@/lib/dashboard/chart-spec";

/**
 * CRUD for pinned dashboard tiles. Single-tenant: there's one shared dashboard,
 * so no user/dashboard scoping — a tile is just (spec, layout).
 */

export interface TileLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileRow {
  id: string;
  title: string;
  spec: ChartSpec;
  layout: TileLayout;
  created_at: string;
  updated_at: string;
}

function defaultLayoutForKind(kind: ChartSpec["kind"]): Omit<TileLayout, "y"> {
  // KPI cards are short and narrow; everything else is a full-width panel.
  if (kind === "kpi") return { x: 0, w: 4, h: 3 };
  return { x: 0, w: 6, h: 6 };
}

export async function listTiles(): Promise<TileRow[]> {
  const { data, error } = await supabaseAdmin
    .from("dashboard_tile")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listTiles: ${error.message}`);
  return (data ?? []) as TileRow[];
}

export async function getTile(id: string): Promise<TileRow | null> {
  const { data, error } = await supabaseAdmin
    .from("dashboard_tile")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getTile: ${error.message}`);
  return (data ?? null) as TileRow | null;
}

export async function addTile(spec: ChartSpec): Promise<TileRow> {
  // Stack the new tile below the others.
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("dashboard_tile")
    .select("layout");
  if (exErr) throw new Error(`addTile (read): ${exErr.message}`);

  const maxY = (existing ?? []).reduce((acc, row) => {
    const l = (row as { layout: TileLayout | null }).layout;
    if (!l) return acc;
    return Math.max(acc, (l.y ?? 0) + (l.h ?? 0));
  }, 0);

  const layout: TileLayout = { ...defaultLayoutForKind(spec.kind), y: maxY };

  const { data, error } = await supabaseAdmin
    .from("dashboard_tile")
    .insert({ title: spec.title, spec, layout })
    .select("*")
    .single();
  if (error) throw new Error(`addTile (insert): ${error.message}`);
  return data as TileRow;
}

export async function updateTileLayout(
  id: string,
  layout: TileLayout
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("dashboard_tile")
    .update({ layout })
    .eq("id", id);
  if (error) throw new Error(`updateTileLayout: ${error.message}`);
}

export async function deleteTile(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("dashboard_tile")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`deleteTile: ${error.message}`);
}
