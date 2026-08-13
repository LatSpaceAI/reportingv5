// GET  /api/esg/dashboard/tiles  → list pinned tiles
// POST /api/esg/dashboard/tiles  → pin a chart (body: { spec: ChartSpec, presetId? })

import { NextResponse } from "next/server";
import { z } from "zod";

import { ChartSpecSchema } from "@/lib/dashboard/chart-spec";
import { loadCatalogue } from "@/lib/dashboard/catalogue";
import { validateSpec } from "@/lib/dashboard/validate-spec";
import { listTiles, addTile } from "@/lib/dashboard/tiles-repo";
import { addTileToPreset } from "@/lib/dashboard/presets-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tiles = await listTiles();
    return NextResponse.json({ tiles });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ChartSpecSchema.safeParse((body as { spec?: unknown }).spec);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid spec", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const presetParsed = z
    .string()
    .uuid()
    .optional()
    .safeParse((body as { presetId?: unknown }).presetId ?? undefined);
  if (!presetParsed.success) {
    return NextResponse.json({ error: "Invalid presetId" }, { status: 400 });
  }

  // Re-validate against the catalogue so a stale spec can't be pinned.
  const cat = await loadCatalogue();
  const verdict = validateSpec(parsed.data, cat);
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: 400 });
  }

  try {
    const tile = await addTile(parsed.data);
    // No transactions via supabase-js: if this insert fails the tile still
    // exists in "All pins", which is a benign state for this single-tenant app.
    if (presetParsed.data) await addTileToPreset(presetParsed.data, tile.id);
    return NextResponse.json({ tile }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
