// Are the computed figures behind the constants?
//
//   GET /api/esg/constants/staleness
//
// Cheap enough to poll, and the seam the dashboard and export can reuse later —
// they show figures computed from whatever the constants were at the time, and
// have no way to say so today.

import { computeStaleness } from "@/lib/esgConstants/staleness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const staleness = await computeStaleness();
    return new Response(JSON.stringify({ ok: true, staleness }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[constants/staleness] failed", { message });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
