// GET  /api/esg/dashboard/presets/:id/tiles  → tiles in preset (per-preset layout)
// POST /api/esg/dashboard/presets/:id/tiles  → add an existing tile (body: { tileId })

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  listPresetTiles,
  addTileToPreset,
} from "@/lib/dashboard/presets-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AddTileSchema = z.object({
  tileId: z.string().uuid(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const tiles = await listPresetTiles(id);
    return NextResponse.json({ tiles });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AddTileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid tileId", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    await addTileToPreset(id, parsed.data.tileId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
