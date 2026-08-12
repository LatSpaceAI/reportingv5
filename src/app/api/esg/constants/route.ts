// The constants register, plus whether the computed figures are behind it.
//
//   GET /api/esg/constants
//
// no-store is not optional here. BIRLA_ESTATES.md records response caching as a
// real bug on the entry read routes — `force-dynamic` alone did not stop it, and
// a cached list would show the user their own edit reverting a moment after they
// made it.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listConstants } from "@/lib/esgConstants/revisions";
import { computeStaleness } from "@/lib/esgConstants/staleness";

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

export async function GET(): Promise<Response> {
  try {
    const [constants, staleness, { data: categories }] = await Promise.all([
      listConstants(),
      computeStaleness(),
      // Rendered from the table rather than a hardcoded list of four: 11_import
      // _batch.sql added DATA_QUALITY after the original seed, and a fifth
      // category invisible to the UI would be uneditable.
      supabaseAdmin.from("constant_category").select("code, name").order("code"),
    ]);

    return json({
      ok: true,
      constants,
      staleness,
      categories: (categories ?? []).map((c) => ({
        code: c.code as string,
        name: c.name as string,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[constants] failed", { message });
    return json({ ok: false, error: message }, 500);
  }
}
