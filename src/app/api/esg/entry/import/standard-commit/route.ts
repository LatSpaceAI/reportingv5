// Commits a previewed STANDARD template import into input_value.
//
//   POST /api/esg/entry/import/standard-commit
//   { batchId, siteCode, fiscalYear, monthNo, overrideExisting?, edits? }
//
// Sibling of import/commit. The two differ ONLY in how a spreadsheet cell became
// a (parameterKey, value) pair — this path read an explicit input_parameter.key
// out of a hidden column, so there is nothing to fuzzy-match and no field-level
// unit factor to apply. Everything after that is @/lib/esgCommit/commitValues,
// which carries the four guarantees.
//
// WHY THE ROWS ARE RE-READ FROM import_batch_row RATHER THAN RE-PARSED
//
// The preview step already recorded what it read. Re-parsing the file would
// invite the two reads to disagree, and the reviewer's corrections apply to what
// the preview showed them. So the batch is the source of truth from here.

import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  commitValues,
  assertCommittableBatch,
  type AccumulatedValue,
} from "@/lib/esgCommit/commitValues";
import { splitSourceLabel } from "@/lib/standardTemplate/templateLayout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StandardCommitRequest {
  batchId: number;
  siteCode: string;
  fiscalYear: string;
  monthNo: number;
  overrideExisting?: boolean;
  enteredBy?: string;
  /** Reviewer corrections, keyed by parameter key — already canonical. */
  edits?: { key: string; value: number | null; notAvailable: boolean }[];
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
  let body: StandardCommitRequest;
  try {
    body = (await req.json()) as StandardCommitRequest;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const { batchId, siteCode, fiscalYear, monthNo } = body;
  if (!batchId || !siteCode || !fiscalYear || !Number.isInteger(monthNo)) {
    return json(
      { ok: false, error: "batchId, siteCode, fiscalYear and monthNo are required" },
      400
    );
  }

  try {
    const [{ data: site }, { data: period }] = await Promise.all([
      supabaseAdmin.from("site").select("id, code, name").eq("code", siteCode).single(),
      supabaseAdmin
        .from("period")
        .select("id, month_no, month_label")
        .eq("fiscal_year", fiscalYear)
        .eq("period_kind", "month")
        .eq("month_no", monthNo)
        .single(),
    ]);

    if (!site) return json({ ok: false, error: `Unknown site '${siteCode}'.` }, 404);
    if (!period) {
      return json({ ok: false, error: `Unknown period ${fiscalYear} month ${monthNo}.` }, 404);
    }

    const gate = await assertCommittableBatch(batchId, site.id, period.id);
    if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);
    const batch = gate.batch;

    // ---- Read back what the preview recorded ------------------------------
    const { data: rowData, error: rowsErr } = await supabaseAdmin
      .from("import_batch_row")
      .select("source_label, sheet_cell, raw_text, canonical_value, is_not_available, match_confidence")
      .eq("batch_id", batchId);
    if (rowsErr) throw rowsErr;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (rowData ?? []) as any[];

    const editByKey = new Map((body.edits ?? []).map((e) => [e.key, e]));

    const values = new Map<string, AccumulatedValue>();
    const labelsByKey: Record<string, string> = {};

    for (const r of rows) {
      // Unmatched rows were recorded for the audit trail; they are never written.
      if (r.match_confidence === "unmatched") continue;

      const { key, label: canonicalLabel } = splitSourceLabel(r.source_label);
      if (!key) continue;

      if (canonicalLabel) labelsByKey[key] = canonicalLabel;

      const edit = editByKey.get(key);

      // The template asks for canonical units, so a reviewer's correction needs
      // no unit factor — unlike the client's-own-form path, where the reviewer
      // types in the form's unit and it is scaled on the way in.
      const canonical = edit
        ? edit.value
        : r.canonical_value == null
          ? null
          : Number(r.canonical_value);
      const isNa = edit ? edit.notAvailable : Boolean(r.is_not_available);

      const cur =
        values.get(key) ??
        ({ sum: 0, anyValue: false, anyNa: false, rawTexts: [], cells: [] } as AccumulatedValue);

      if (isNa) {
        cur.anyNa = true;
      } else if (canonical != null) {
        cur.sum += canonical;
        cur.anyValue = true;
      }
      if (r.raw_text) cur.rawTexts.push(String(r.raw_text));
      if (r.sheet_cell) cur.cells.push(String(r.sheet_cell));

      values.set(key, cur);
    }

    const result = await commitValues({
      siteId: site.id,
      periodId: period.id,
      fiscalYear,
      monthNo,
      monthLabel: (period.month_label as string | null) ?? null,
      siteName: site.name,
      batchId,
      sourceBase: `${batch.filename}${batch.sheetName ? ` › ${batch.sheetName}` : ""}`,
      enteredBy: body.enteredBy ?? batch.uploadedBy ?? "esg-team",
      values,
      overrideExisting: body.overrideExisting,
      // is_required lives on site_form_field, which does not describe this
      // template — so REQUIRED_FIELD_MISSING cannot fire on this path. A
      // deliberate gap awaiting an ESG-team decision, not an oversight.
      requiredKeys: [],
      labelsByKey,
      nothingMappedError:
        "None of the rows in this template carried a recognised parameter key.",
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[entry/import/standard-commit] failed", {
      siteCode,
      fiscalYear,
      monthNo,
      message,
    });
    return json({ ok: false, error: message }, 500);
  }
}
