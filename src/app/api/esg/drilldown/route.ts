// How was this number computed?
//
//   GET /api/esg/drilldown?key=en.diesel_stationary&site=GROUP&fy=2024-25
//
// Returns the formula chain, the constants with their current values, and the
// full monthly input matrix across contributing sites — with filed / filed-NA /
// not-filed distinguished per cell, because "nobody filed a return" is not zero
// and must never render as one.
//
// no-store, like every read route here: BIRLA_ESTATES.md records response
// caching as a real bug, and a cached provenance tree could show working that
// does not match the figure beside it.

import { NextRequest } from "next/server";

import { resolveDrilldown } from "@/lib/drilldown/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  const sp = req.nextUrl.searchParams;
  const key = sp.get("key");
  const site = sp.get("site") ?? "GROUP";
  const fy = sp.get("fy");
  const periodKind = sp.get("period") === "month" ? "month" : "ytd";

  if (!key) return json({ ok: false, error: "key is required" }, 400);
  if (!fy || !/^\d{4}-\d{2}$/.test(fy)) {
    return json({ ok: false, error: "fy is required, as e.g. 2024-25" }, 400);
  }

  try {
    const drilldown = await resolveDrilldown(key, site, fy, periodKind);
    return json({ ok: true, drilldown });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[drilldown] failed", { key, site, fy, message });
    return json({ ok: false, error: message }, 500);
  }
}
