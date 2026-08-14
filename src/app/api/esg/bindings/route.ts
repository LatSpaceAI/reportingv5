// Bound cells for a report, resolved to values.
//
//   GET /api/esg/bindings?framework=brsr&fy=2024-25
//
// no-store for the same reason every other read route in this app carries it:
// BIRLA_ESTATES.md records response caching as a real bug here, and a stale
// bound value is worse than none — it looks authoritative.
//
// The framework's SCHEMA is not sent by the client. Staleness detection
// compares the label a binding stored against the label the schema reads today,
// so the schema has to be the server's own copy or the check is worthless.

import { NextRequest } from "next/server";

import { readBoundCells } from "@/lib/reportBindings/read";
import { getFramework } from "@/lib/frameworks";

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
  const framework = req.nextUrl.searchParams.get("framework") ?? "brsr";
  const fy = req.nextUrl.searchParams.get("fy");

  if (!fy || !/^\d{4}-\d{2}$/.test(fy)) {
    return json({ ok: false, error: "fy is required, as e.g. 2024-25" }, 400);
  }

  const fw = getFramework(framework);
  if (!fw) return json({ ok: false, error: `Unknown framework "${framework}"` }, 404);

  try {
    const cells = await readBoundCells(framework, fy, fw.sections);
    return json({ ok: true, fiscalYear: fy, cells });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[bindings] failed", { framework, fy, message });
    return json({ ok: false, error: message }, 500);
  }
}
