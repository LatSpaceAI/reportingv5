// PATCH  /api/esg/dashboard/presets/:id/tiles/:tileId  → per-preset grid layout
// DELETE /api/esg/dashboard/presets/:id/tiles/:tileId  → remove from preset only

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  updatePresetTileLayout,
  removeTileFromPreset,
} from "@/lib/dashboard/presets-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LayoutPatchSchema = z.object({
  layout: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(24),
    h: z.number().int().min(1).max(24),
  }),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; tileId: string }> }
) {
  const { id, tileId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = LayoutPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid layout", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    await updatePresetTileLayout(id, tileId, parsed.data.layout);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; tileId: string }> }
) {
  const { id, tileId } = await ctx.params;
  try {
    await removeTileFromPreset(id, tileId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
