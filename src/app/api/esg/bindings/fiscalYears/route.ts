// Which fiscal years actually have computed figures.
//
//   GET /api/esg/bindings/fiscalYears
//
// The Requirements tab resolves bound metrics against the year the report says
// it covers (Section A item 9). That field is free text and is very often
// blank on a fresh report — and when it is, every bound cell silently showed
// nothing, which reads as "the feature is broken" rather than "tell me the
// year". This endpoint gives the UI a defensible fallback: the latest year
// that has output_value rows at all.
//
// Ordered newest first. Periods are seeded a year ahead of the data
// (BIRLA_ESTATES.md), so the newest SEEDED year is routinely empty — hence
// "years with values", not "years".

import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
    const { data: periods, error } = await supabaseAdmin
      .from("period")
      .select("id, fiscal_year, period_kind")
      .eq("period_kind", "ytd");
    if (error) throw new Error(error.message);

    const byId = new Map<number, string>();
    for (const p of periods ?? []) byId.set(p.id as number, p.fiscal_year as string);
    if (byId.size === 0) return json({ ok: true, fiscalYears: [] });

    // ORDERED BY EVIDENCE, NOT BY RECENCY.
    //
    // The newest year with any data is routinely a PARTIAL one: periods are
    // seeded ahead and the resolver writes a YTD row as soon as a single month
    // is filed. FY2025-26 currently carries one month, so "newest" would offer
    // a fragment where a reader expects the completed reporting year.
    //
    // Evidence is counted as DISTINCT FILED SITE-MONTHS, from site_submission.
    // Summing output_value.sites_reporting was tried and is wrong: it
    // accumulates once per output parameter, so a single site filing twelve
    // months outranks four sites filing eight — which is how FY2023-24
    // (Aurora alone) beat FY2024-25.
    const { data: monthPeriods, error: mErr } = await supabaseAdmin
      .from("period")
      .select("id, fiscal_year")
      .eq("period_kind", "month");
    if (mErr) throw new Error(mErr.message);

    const fyByMonthId = new Map<number, string>();
    for (const p of monthPeriods ?? []) fyByMonthId.set(p.id as number, p.fiscal_year as string);

    const { data: subs, error: sErr } = await supabaseAdmin
      .from("site_submission")
      .select("site_id, period_id");
    if (sErr) throw new Error(sErr.message);

    // RANKED BY HOW MANY SITES FILED, THEN BY SITE-MONTHS.
    //
    // Site-months alone picks the wrong year here: FY2023-24 has 12 (Aurora
    // filing every month, alone) against FY2024-25's 9 across FOUR sites. BRSR
    // is an entity-level disclosure, so a year covering four sites is a better
    // default than a year covering one, however many months that one filed.
    const siteMonths = new Map<string, number>();
    const sitesPerYear = new Map<string, Set<number>>();
    for (const s of subs ?? []) {
      const fy = fyByMonthId.get(s.period_id as number);
      if (!fy) continue;
      siteMonths.set(fy, (siteMonths.get(fy) ?? 0) + 1);
      if (!sitesPerYear.has(fy)) sitesPerYear.set(fy, new Set());
      sitesPerYear.get(fy)!.add(s.site_id as number);
    }
    const filedBy = siteMonths;

    // A year needs BOTH filed returns and computed values to be offered: a
    // return filed but never resolved would hand back a year of empty cells.
    const { data: values, error: vErr } = await supabaseAdmin
      .from("output_value")
      .select("period_id")
      .in("period_id", [...byId.keys()])
      .not("value_num", "is", null);
    if (vErr) throw new Error(vErr.message);

    const hasValues = new Set<string>();
    for (const v of values ?? []) {
      const fy = byId.get(v.period_id as number);
      if (fy) hasValues.add(fy);
    }

    const siteCount = (fy: string) => sitesPerYear.get(fy)?.size ?? 0;

    const fiscalYears = [...hasValues].sort(
      (a, b) =>
        siteCount(b) - siteCount(a) ||
        (filedBy.get(b) ?? 0) - (filedBy.get(a) ?? 0) ||
        b.localeCompare(a)
    );

    return json({
      ok: true,
      fiscalYears,
      /** Why the order is what it is: sites first, then site-months. */
      evidence: Object.fromEntries(
        [...hasValues].map((fy) => [
          fy,
          { sites: siteCount(fy), siteMonths: filedBy.get(fy) ?? 0 },
        ])
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[bindings/fiscalYears] failed", { message });
    return json({ ok: false, error: message }, 500);
  }
}
