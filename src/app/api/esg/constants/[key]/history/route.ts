// The audit trail for one constant.
//
//   GET /api/esg/constants/EF.diesel/history
//
// Append-only, newest first. A revert appears as its own row rather than as the
// deletion of the thing it undid — an audit trail you can delete from is not an
// audit trail.

import { NextRequest } from "next/server";

import { listRevisions } from "@/lib/esgConstants/revisions";

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

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
): Promise<Response> {
  const { key } = await ctx.params;
  try {
    return json({ ok: true, revisions: await listRevisions(key) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[constants/history] failed", { key, message });
    return json({ ok: false, error: message }, 500);
  }
}
