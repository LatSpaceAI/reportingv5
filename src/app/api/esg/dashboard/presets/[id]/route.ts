// PATCH  /api/esg/dashboard/presets/:id  → rename (body: { name })
// DELETE /api/esg/dashboard/presets/:id  → delete preset (memberships cascade)

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  renamePreset,
  deletePreset,
  DuplicatePresetNameError,
} from "@/lib/dashboard/presets-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RenameSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function PATCH(
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

  const parsed = RenameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid name", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    await renamePreset(id, parsed.data.name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DuplicatePresetNameError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    await deletePreset(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
