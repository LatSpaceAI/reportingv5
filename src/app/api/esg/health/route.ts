import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Connection smoke-test for the ESG database.
// GET /api/esg/health -> per-table probe with full error detail.
export const dynamic = "force-dynamic";

type Probe = {
  table: string;
  ok: boolean;
  count: number | null;
  error: null | {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  };
};

async function probe(table: string): Promise<Probe> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true });
  return {
    table,
    ok: !error,
    count: count ?? null,
    error: error
      ? {
          message: error.message,
          code: (error as { code?: string }).code,
          details: (error as { details?: string }).details,
          hint: (error as { hint?: string }).hint,
        }
      : null,
  };
}

export async function GET() {
  // env visibility (without leaking secrets)
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    SUPABASE_SERVICE_ROLE_KEY_present: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    service_role_len: process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
  };

  try {
    const probes = await Promise.all(
      [
        "constant",
        "input_parameter",
        "output_parameter",
        "formula",
        "v_formula_catalogue",
        "v_formula_missing_refs",
      ].map(probe)
    );

    const allOk = probes.every((p) => p.ok);
    return NextResponse.json(
      { ok: allOk, env, probes },
      { status: allOk ? 200 : 500 }
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        env,
        thrown: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
