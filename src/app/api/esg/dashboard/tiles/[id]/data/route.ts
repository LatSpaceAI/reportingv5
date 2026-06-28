// GET /api/esg/dashboard/tiles/:id/data → hydrate a pinned tile with live data

import { NextResponse } from "next/server";

import { getTile } from "@/lib/dashboard/tiles-repo";
import { loadCatalogue } from "@/lib/dashboard/catalogue";
import { fetchChartData } from "@/lib/dashboard/fetch-chart-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  try {
    const tile = await getTile(id);
    if (!tile) {
      return NextResponse.json({ error: "Tile not found" }, { status: 404 });
    }
    const cat = await loadCatalogue();
    const data = await fetchChartData(tile.spec, cat);
    return NextResponse.json({ tile, data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
