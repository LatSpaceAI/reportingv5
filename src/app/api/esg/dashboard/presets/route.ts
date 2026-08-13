// GET  /api/esg/dashboard/presets  → list presets
// POST /api/esg/dashboard/presets  → create a preset (body: { name })

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  listPresets,
  createPreset,
  DuplicatePresetNameError,
} from "@/lib/dashboard/presets-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET() {
  try {
    const presets = await listPresets();
    return NextResponse.json({ presets });
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

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid name", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const preset = await createPreset(parsed.data.name);
    return NextResponse.json({ preset }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicatePresetNameError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
