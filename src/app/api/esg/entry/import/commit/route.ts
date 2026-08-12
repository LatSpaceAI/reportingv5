// Commit a previewed import of the CLIENT'S OWN monthly form into input_value.
//
// This route owns exactly one thing: turning rows that were matched by fuzzy
// LABEL against a per-site site_form_field replica into (parameterKey, value)
// pairs. That is the part specific to the client's own paper forms — including
// the field-level unit_factor, because a form says "Ltrs" where the disclosure
// says kL, and the aggregation of several form rows into one parameter.
//
// Everything after that — supersession, history-before-write, validation,
// submission state, batch closure — lives in @/lib/esgCommit/commitValues,
// shared with the standard-template path. The four guarantees are documented
// there. Two ways in, one way to persist.

import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveContext } from "@/lib/siteEntry/importService";
import {
  commitValues,
  assertCommittableBatch,
  type AccumulatedValue,
} from "@/lib/esgCommit/commitValues";
import type { CommitRequest, CommitResponse } from "@/lib/siteEntry/importTypes";

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

export async function POST(req: NextRequest): Promise<Response> {
  let body: CommitRequest;
  try {
    body = (await req.json()) as CommitRequest;
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
    const ctx = await resolveContext(siteCode, fiscalYear, monthNo);

    const gate = await assertCommittableBatch(batchId, ctx.site.id, ctx.period.id);
    if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);
    const batch = gate.batch;

    const { data: rowData, error: rowsErr } = await supabaseAdmin
      .from("import_batch_row")
      .select(
        "id, sheet_cell, source_label, raw_text, matched_field_id, parsed_value, " +
          "unit_factor, canonical_value, is_not_available"
      )
      .eq("batch_id", batchId);
    if (rowsErr) throw rowsErr;
    // This project has no generated Supabase types, so rows from the newer
    // tables come back untyped. Same convention as the export module.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (rowData ?? []) as any[];

    // ---- Apply the reviewer's corrections -----------------------------------
    const editByField = new Map((body.edits ?? []).map((e) => [e.fieldId, e]));
    const fieldById = new Map(ctx.fields.map((f) => [f.fieldId, f]));

    /** Accumulated canonical values, summing rows that share a parameter. */
    const acc = new Map<string, AccumulatedValue>();

    for (const r of rows) {
      const fieldId = r.matched_field_id as number | null;
      if (!fieldId) continue; // unmatched rows are recorded, never written
      const field = fieldById.get(fieldId);
      if (!field?.parameterKey) continue;

      const edit = editByField.get(fieldId);
      const factor = Number(r.unit_factor ?? field.unitFactor ?? 1);

      let canonical: number | null;
      let isNa: boolean;
      if (edit) {
        // The reviewer types in the FORM's unit, same as the manual screen.
        canonical = edit.value == null ? null : edit.value * factor;
        isNa = edit.notAvailable;
      } else {
        canonical = r.canonical_value == null ? null : Number(r.canonical_value);
        isNa = Boolean(r.is_not_available);
      }

      const key = field.parameterKey;
      const cur =
        acc.get(key) ??
        { sum: 0, anyValue: false, anyNa: false, rawTexts: [], cells: [] };

      if (isNa) {
        cur.anyNa = true;
      } else if (canonical != null) {
        cur.sum += canonical;
        cur.anyValue = true;
      }
      if (r.raw_text) cur.rawTexts.push(String(r.raw_text));
      if (r.sheet_cell) cur.cells.push(String(r.sheet_cell));
      acc.set(key, cur);
    }

    // ---- Persist ------------------------------------------------------------
    // Everything from here is shared with the standard-template path: parameter
    // ids, override consent, history-before-write, validation, draft status and
    // batch closure. See @/lib/esgCommit/commitValues for the guarantees.
    const result = await commitValues({
      siteId: ctx.site.id,
      periodId: ctx.period.id,
      fiscalYear,
      monthNo,
      monthLabel: ctx.period.monthLabel ?? null,
      siteName: ctx.site.name,
      batchId,
      sourceBase: `${batch.filename}${batch.sheetName ? ` › ${batch.sheetName}` : ""}`,
      enteredBy: body.enteredBy ?? batch.uploadedBy ?? "esg-team",
      values: acc,
      overrideExisting: body.overrideExisting,
      // Preserves this route's original wording: this path matches labels
      // against the site's own form, so "form row" is the accurate noun.
      nothingMappedError: "Nothing in this file could be mapped to a form row.",
      // is_required is a property of the FORM row, so only this path can supply
      // it. The standard template has no equivalent and passes [].
      requiredKeys: ctx.fields
        .filter((f) => f.isRequired && f.parameterKey)
        .map((f) => f.parameterKey!),
      labelsByKey: Object.fromEntries(
        ctx.fields.filter((f) => f.parameterKey).map((f) => [f.parameterKey!, f.label])
      ),
    });

    if (!result.ok) {
      if (result.requiresOverride) {
        return json({ ok: false, requiresOverride: true, error: result.error } satisfies CommitResponse, 409);
      }
      return json({ ok: false, error: result.error }, result.unprocessable ? 422 : 400);
    }

    const response: CommitResponse = {
      ok: true,
      saved: result.saved,
      superseded: result.superseded,
      flags: result.flags,
      status: result.status,
    };
    return json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[entry/import/commit] failed", { siteCode, fiscalYear, monthNo, message });
    return json({ ok: false, error: message }, 500);
  }
}
