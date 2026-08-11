// Sites, periods, and per-month coverage for the entry screen's pickers.
//
// Coverage is returned alongside the lists because it is the honest answer to
// "is this month done?" — the platform has no derived-balance mechanism, so a
// portfolio total is only ever the sum of what was filed. Showing 4-of-11 on the
// picker is how that stays visible at the point of work.

import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// No-store so the coverage counts reflect a submission the moment it is made
// (see the note in ../form/route.ts).
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export interface CoverageRow {
  fiscalYear: string;
  monthNo: number;
  monthLabel: string;
  sitesReporting: number;
  sitesExpected: number;
}

export async function GET(req: NextRequest): Promise<Response> {
  const fy = new URL(req.url).searchParams.get("fy") ?? undefined;

  try {
    const [{ data: sites, error: siteErr }, { data: periods, error: periodErr }] =
      await Promise.all([
        supabaseAdmin
          .from("site")
          .select("id, code, name, asset_type, city, region, water_stressed, is_group")
          .eq("is_group", false)
          .order("asset_type")
          .order("name"),
        supabaseAdmin
          .from("period")
          .select("id, fiscal_year, period_kind, month_no, month_label")
          .eq("period_kind", "month")
          .order("fiscal_year", { ascending: false })
          .order("month_no"),
      ]);
    if (siteErr) throw siteErr;
    if (periodErr) throw periodErr;

    // Submissions that count as "filed" — a draft is work in progress, not a
    // return, so it does not raise the coverage number.
    const { data: submissions, error: subErr } = await supabaseAdmin
      .from("site_submission")
      .select("site_id, period_id, status");
    if (subErr) throw subErr;

    const filedByPeriod = new Map<number, number>();
    for (const s of submissions ?? []) {
      if (!["submitted", "under_review", "approved"].includes(s.status as string)) continue;
      const pid = s.period_id as number;
      filedByPeriod.set(pid, (filedByPeriod.get(pid) ?? 0) + 1);
    }

    const siteCount = (sites ?? []).length;
    const coverage: CoverageRow[] = (periods ?? [])
      .filter((p) => !fy || p.fiscal_year === fy)
      .map((p) => ({
        fiscalYear: p.fiscal_year as string,
        monthNo: p.month_no as number,
        monthLabel: p.month_label as string,
        sitesReporting: filedByPeriod.get(p.id as number) ?? 0,
        sitesExpected: siteCount,
      }));

    // Distinct fiscal years, newest first, for the year picker.
    const fiscalYears = [...new Set((periods ?? []).map((p) => p.fiscal_year as string))].sort(
      (a, b) => b.localeCompare(a)
    );

    return json({
      sites: (sites ?? []).map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        assetType: s.asset_type,
        city: s.city,
        region: s.region,
        waterStressed: Boolean(s.water_stressed),
      })),
      fiscalYears,
      coverage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[entry/sites] failed", { message });
    return json({ error: `Could not load sites: ${message}` }, 500);
  }
}
