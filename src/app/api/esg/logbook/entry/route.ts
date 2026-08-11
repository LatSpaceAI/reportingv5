// The data points behind one logbook row, fetched when it is expanded.
//
// Returns the live values, the flags still open against them, and anything a
// re-upload superseded. History is included because the logbook is where a
// mistaken override has to be visible — a replaced figure that left no trace
// would make the audit trail a claim rather than a fact.

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

export interface LogbookValue {
  parameterKey: string;
  parameterLabel: string;
  unit: string | null;
  valueNum: number | null;
  isNotAvailable: boolean;
  provenance: string;
  rawText: string | null;
  sourceDoc: string | null;
  enteredBy: string | null;
  updatedAt: string | null;
  isMemo: boolean;
}

export interface LogbookHistoryValue {
  parameterKey: string;
  parameterLabel: string;
  valueNum: number | null;
  isNotAvailable: boolean;
  provenance: string | null;
  enteredBy: string | null;
  supersededAt: string;
  supersededByBatchId: number | null;
}

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const siteId = Number(url.searchParams.get("siteId"));
  const periodId = Number(url.searchParams.get("periodId"));

  if (!Number.isInteger(siteId) || !Number.isInteger(periodId)) {
    return json({ error: "siteId and periodId are required" }, 400);
  }

  try {
    const [{ data: values, error: vErr }, { data: flags }, { data: history }, { data: batch }] =
      await Promise.all([
        supabaseAdmin
          .from("input_value")
          .select(
            "value_num, is_not_available, provenance, raw_text, source_doc, entered_by, " +
              "updated_at, parameter:parameter_id(key, label, unit, is_memo)"
          )
          .eq("site_id", siteId)
          .eq("period_id", periodId)
          .is("superseded_at", null),
        supabaseAdmin
          .from("data_flag")
          .select("rule_code, severity, message, acknowledged_at, parameter:parameter_id(key)")
          .eq("site_id", siteId)
          .eq("period_id", periodId),
        supabaseAdmin
          .from("input_value_history")
          .select(
            "value_num, is_not_available, provenance, entered_by, superseded_at, " +
              "superseded_by_batch_id, parameter:parameter_id(key, label)"
          )
          .eq("site_id", siteId)
          .eq("period_id", periodId)
          .order("superseded_at", { ascending: false }),
        supabaseAdmin
          .from("import_batch")
          .select("id, filename, sheet_name, uploaded_by, committed_at, row_count, matched_count, unmatched_count")
          .eq("site_id", siteId)
          .eq("period_id", periodId)
          .eq("status", "committed")
          .order("committed_at", { ascending: false }),
      ]);
    if (vErr) throw vErr;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: LogbookValue[] = ((values ?? []) as any[])
      .map((v) => ({
        parameterKey: v.parameter?.key ?? "",
        parameterLabel: v.parameter?.label ?? v.parameter?.key ?? "",
        unit: v.parameter?.unit ?? null,
        valueNum: v.value_num == null ? null : Number(v.value_num),
        isNotAvailable: Boolean(v.is_not_available),
        provenance: String(v.provenance ?? "entered"),
        rawText: (v.raw_text as string | null) ?? null,
        sourceDoc: (v.source_doc as string | null) ?? null,
        enteredBy: (v.entered_by as string | null) ?? null,
        updatedAt: (v.updated_at as string | null) ?? null,
        isMemo: Boolean(v.parameter?.is_memo),
      }))
      .sort((a, b) => a.parameterKey.localeCompare(b.parameterKey));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const historyRows: LogbookHistoryValue[] = ((history ?? []) as any[]).map((h) => ({
      parameterKey: h.parameter?.key ?? "",
      parameterLabel: h.parameter?.label ?? h.parameter?.key ?? "",
      valueNum: h.value_num == null ? null : Number(h.value_num),
      isNotAvailable: Boolean(h.is_not_available),
      provenance: (h.provenance as string | null) ?? null,
      enteredBy: (h.entered_by as string | null) ?? null,
      supersededAt: h.superseded_at as string,
      supersededByBatchId: (h.superseded_by_batch_id as number | null) ?? null,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flagRows = ((flags ?? []) as any[]).map((f) => ({
      parameterKey: f.parameter?.key ?? null,
      ruleCode: f.rule_code as string,
      severity: f.severity as "info" | "warning" | "error",
      message: f.message as string,
      acknowledgedAt: (f.acknowledged_at as string | null) ?? null,
    }));

    return json({
      values: rows,
      flags: flagRows,
      history: historyRows,
      imports: batch ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[logbook/entry] failed", { siteId, periodId, message });
    return json({ error: `Could not load the entry: ${message}` }, 500);
  }
}
