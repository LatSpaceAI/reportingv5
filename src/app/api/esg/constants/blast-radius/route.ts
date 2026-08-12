// What would editing this constant change?
//
//   POST /api/esg/constants/blast-radius   { key }
//
// POST rather than GET: it is a computation over a body, and it must never be
// cached — a stale radius shown at a confirm step is worse than no radius.

import { NextRequest } from "next/server";

import { computeBlastRadius } from "@/lib/esgConstants/blastRadius";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  let key: string;
  try {
    ({ key } = (await req.json()) as { key: string });
  } catch {
    return respond({ ok: false, error: "Invalid JSON" }, 400);
  }
  if (!key) return respond({ ok: false, error: "key is required" }, 400);

  try {
    return respond({ ok: true, radius: await computeBlastRadius(key) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[constants/blast-radius] failed", { key, message });
    return respond({ ok: false, error: message }, 500);
  }
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
