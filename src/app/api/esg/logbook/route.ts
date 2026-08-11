// The logbook: every entered site-month, newest first.
//
// One row per (site, period) that holds data, whether it was typed in or
// imported. The list is deliberately cheap — counts only — and the data points
// for a row are fetched when it is expanded, because a portfolio-wide list with
// every value inlined would be thousands of rows nobody has scrolled to yet.

import { NextRequest } from "next/server";
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

export interface LogbookEntrySummary {
  siteId: number;
  siteCode: string;
  siteName: string;
  periodId: number;
  fiscalYear: string;
  monthNo: number | null;
  monthLabel: string | null;
  status: string;
  valueCount: number;
  importedCount: number;
  naCount: number;
  openFlagCount: number;
  lastEnteredBy: string | null;
  lastUpdatedAt: string | null;
  sourceDoc: string | null;
  importBatchId: number | null;
}

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const fy = url.searchParams.get("fy");
  const siteCode = url.searchParams.get("site");

  try {
    let q = supabaseAdmin.from("v_logbook_entries").select("*");
    if (fy) q = q.eq("fiscal_year", fy);
    if (siteCode) q = q.eq("site_code", siteCode);

    const { data, error } = await q;
    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries: LogbookEntrySummary[] = ((data ?? []) as any[])
      .map((r) => ({
        siteId: r.site_id as number,
        siteCode: r.site_code as string,
        siteName: r.site_name as string,
        periodId: r.period_id as number,
        fiscalYear: r.fiscal_year as string,
        monthNo: (r.month_no as number | null) ?? null,
        monthLabel: (r.month_label as string | null) ?? null,
        status: (r.status as string) ?? "draft",
        valueCount: Number(r.value_count ?? 0),
        importedCount: Number(r.imported_count ?? 0),
        naCount: Number(r.na_count ?? 0),
        openFlagCount: Number(r.open_flag_count ?? 0),
        lastEnteredBy: (r.last_entered_by as string | null) ?? null,
        lastUpdatedAt: (r.last_updated_at as string | null) ?? null,
        sourceDoc: (r.source_doc as string | null) ?? null,
        importBatchId: (r.import_batch_id as number | null) ?? null,
      }))
      // Newest first. Sorting here rather than in the view keeps the ordering
      // rule next to the shape the UI depends on.
      .sort((a, b) => {
        const t = (b.lastUpdatedAt ?? "").localeCompare(a.lastUpdatedAt ?? "");
        if (t !== 0) return t;
        return (
          b.fiscalYear.localeCompare(a.fiscalYear) || (b.monthNo ?? 0) - (a.monthNo ?? 0)
        );
      });

    const fiscalYears = [...new Set(entries.map((e) => e.fiscalYear))].sort((a, b) =>
      b.localeCompare(a)
    );

    return json({ entries, fiscalYears });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[logbook] failed", { message });
    return json({ error: `Could not load the logbook: ${message}` }, 500);
  }
}
