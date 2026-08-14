// Commits a previewed HR/Procurement monthly return into input_value.
//
//   POST /api/esg/hr-proc/commit
//   { batchId, fiscalYear, monthNo, overrideExisting?, enteredBy? }
//
// The client sends a batch id, not data: what commits is exactly what the
// preview recorded (standard-commit precedent). Everything after matching is
// @/lib/esgCommit/commitValues with its four guarantees — plus the scope this
// path adds: supersession is restricted to the parameters of the domains the
// uploaded file actually carried, because HR and Procurement share the
// (GROUP, month) slot and an unscoped override of one would silently destroy
// the other.

import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  commitValues,
  assertCommittableBatch,
  type AccumulatedValue,
} from "@/lib/esgCommit/commitValues";
import { splitSourceLabel } from "@/lib/standardTemplate/templateLayout";
import {
  layoutCellByKey,
  loadDomainParameters,
  resolveTarget,
} from "@/lib/hrProcReturn/returnService";
import type { ReturnDomain } from "@/lib/hrProcReturn/layoutTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CommitRequest {
  batchId: number;
  fiscalYear: string;
  monthNo: number;
  overrideExisting?: boolean;
  enteredBy?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: CommitRequest;
  try {
    body = (await req.json()) as CommitRequest;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const { batchId, fiscalYear, monthNo } = body;
  if (!batchId || !fiscalYear || !Number.isInteger(monthNo)) {
    return json({ ok: false, error: "batchId, fiscalYear and monthNo are required" }, 400);
  }

  try {
    const resolved = await resolveTarget(fiscalYear, monthNo);
    if (!resolved.ok) return json({ ok: false, error: resolved.error }, 422);
    const { site, period } = resolved.target;

    const gate = await assertCommittableBatch(batchId, site.id, period.id);
    if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);
    const batch = gate.batch;

    // ---- Read back what the preview recorded ------------------------------
    // Paged: PostgREST caps a single select at 1000 rows and a two-sheet
    // upload records ~330, but the cap is not this route's to rely on.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("import_batch_row")
        .select("source_label, sheet_cell, raw_text, canonical_value, is_not_available, match_confidence")
        .eq("batch_id", batchId)
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    const values = new Map<string, AccumulatedValue>();
    const labelsByKey: Record<string, string> = {};
    const domains = new Set<ReturnDomain>();

    for (const r of rows) {
      if (r.match_confidence === "unmatched") continue;

      const { key, label } = splitSourceLabel(r.source_label);
      if (!key) continue;
      const spec = layoutCellByKey(key);
      if (!spec) continue;

      if (label) labelsByKey[key] = label;
      domains.add(key.startsWith("hr.") ? "HR" : "PROCUREMENT");

      const acc: AccumulatedValue = {
        sum: 0,
        anyValue: false,
        anyNa: false,
        rawTexts: r.raw_text ? [String(r.raw_text)] : [],
        cells: r.sheet_cell ? [String(r.sheet_cell)] : [],
      };
      if (spec.kind === "text") {
        acc.text = r.raw_text ? String(r.raw_text) : null;
      } else if (r.is_not_available) {
        acc.anyNa = true;
      } else if (r.canonical_value != null) {
        acc.sum = Number(r.canonical_value);
        acc.anyValue = true;
      }
      values.set(key, acc);
    }

    // The supersession scope: every parameter of every domain this file
    // carried — filed or blank. A cumulative re-upload that leaves a cell
    // empty means "nothing to report yet"; the stale value from the earlier
    // month's snapshot of the SAME domain must not survive, but the sibling
    // domain's figures are not this file's to touch.
    const params = await loadDomainParameters();
    const restrictToParameterIds = [...domains].flatMap(
      (d) => params.idsByDomain.get(d) ?? []
    );

    const result = await commitValues({
      siteId: site.id,
      periodId: period.id,
      fiscalYear,
      monthNo,
      monthLabel: period.monthLabel,
      siteName: site.name,
      batchId,
      sourceBase: batch.filename,
      enteredBy: body.enteredBy ?? batch.uploadedBy ?? "esg-team",
      values,
      overrideExisting: body.overrideExisting,
      restrictToParameterIds,
      requiredKeys: [],
      labelsByKey,
      nothingMappedError:
        "None of the previewed cells could be mapped to a seeded HR/Procurement parameter.",
    });

    if (!result.ok) {
      if (result.requiresOverride) {
        return json({ ok: false, requiresOverride: true, error: result.error }, 409);
      }
      return json({ ok: false, error: result.error }, result.unprocessable ? 422 : 400);
    }

    return json({
      ok: true,
      saved: result.saved,
      superseded: result.superseded,
      flags: result.flags,
      status: result.status,
      domains: [...domains],
    });
  } catch (err) {
    // Supabase errors are plain objects with a .message, not Error instances —
    // String() on one prints "[object Object]", which is useless in a toast.
    const message =
      err instanceof Error
        ? err.message
        : ((err as { message?: string })?.message ?? String(err));
    console.error("[hr-proc/commit] failed", { batchId, fiscalYear, monthNo, message });
    return json({ ok: false, error: message }, 500);
  }
}
