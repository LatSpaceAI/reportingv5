// Commit a previewed import into input_value.
//
// TWO GUARANTEES THIS ROUTE MAKES
//
//   1. Nothing is overwritten silently. If the site-month already holds values,
//      the request must carry overrideExisting. Without it the route refuses
//      and tells the client to show the override warning — so a second upload
//      of "March" can never quietly replace March.
//
//   2. Nothing is destroyed. Superseded values are copied into
//      input_value_history with a pointer to the batch that replaced them
//      before the new figures are written. The logbook reads that history, so
//      a mistaken override is visible and recoverable.
//
// Committing does NOT submit the return. status stays 'draft' until a human
// submits it explicitly — an uploaded file is evidence someone typed something,
// not evidence anyone checked it. Only submitted returns feed the resolver.

import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  resolveContext,
  loadPriorValues,
  loadAnomalyTolerance,
} from "@/lib/siteEntry/importService";
import { runValidations, type ParamValues } from "@/lib/siteEntry/validation";
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

    // The batch must exist, be a preview, and be for this exact site-month.
    // Re-committing a batch would double-supersede and orphan history.
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from("import_batch")
      .select("id, site_id, period_id, filename, sheet_name, status, uploaded_by")
      .eq("id", batchId)
      .single();
    if (batchErr || !batch) return json({ ok: false, error: "Unknown import batch." }, 404);
    if (batch.status !== "preview") {
      return json(
        { ok: false, error: `That import was already ${batch.status}.` },
        409
      );
    }
    if (batch.site_id !== ctx.site.id || batch.period_id !== ctx.period.id) {
      return json(
        { ok: false, error: "This import was parsed for a different site or month." },
        409
      );
    }

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
    const acc = new Map<
      string,
      {
        parameterId: number | null;
        sum: number;
        anyValue: boolean;
        anyNa: boolean;
        rawTexts: string[];
        cells: string[];
      }
    >();

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
        { parameterId: null, sum: 0, anyValue: false, anyNa: false, rawTexts: [], cells: [] };

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

    if (acc.size === 0) {
      return json({ ok: false, error: "Nothing in this file could be mapped to a form row." }, 422);
    }

    // ---- Resolve parameter ids ---------------------------------------------
    const keys = [...acc.keys()];
    const { data: params, error: paramErr } = await supabaseAdmin
      .from("input_parameter")
      .select("id, key")
      .in("key", keys);
    if (paramErr) throw paramErr;
    const idByKey = new Map((params ?? []).map((p) => [p.key as string, p.id as number]));

    // ---- Existing data: refuse to overwrite without explicit consent -------
    const { data: existingData, error: exErr } = await supabaseAdmin
      .from("input_value")
      .select(
        "id, parameter_id, value_num, is_not_available, provenance, raw_text, comment, " +
          "source_doc, entered_by, entered_at"
      )
      .eq("site_id", ctx.site.id)
      .eq("period_id", ctx.period.id)
      .is("superseded_at", null);
    if (exErr) throw exErr;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = (existingData ?? []) as any[];

    if (existing.length > 0 && !body.overrideExisting) {
      return json(
        {
          ok: false,
          requiresOverride: true,
          error:
            `${ctx.site.name} already has ${existing.length} values recorded for ` +
            `${ctx.period.monthLabel ?? `month ${monthNo}`} ${fiscalYear}. ` +
            `Confirm the override to replace them.`,
        } satisfies CommitResponse,
        409
      );
    }

    // ---- Archive what is being replaced ------------------------------------
    let superseded = 0;
    if (existing.length) {
      const { error: histErr } = await supabaseAdmin.from("input_value_history").insert(
        existing.map((e) => ({
          site_id: ctx.site.id,
          period_id: ctx.period.id,
          parameter_id: e.parameter_id,
          value_num: e.value_num,
          is_not_available: e.is_not_available,
          provenance: e.provenance,
          raw_text: e.raw_text,
          comment: e.comment,
          source_doc: e.source_doc,
          entered_by: e.entered_by,
          entered_at: e.entered_at,
          superseded_by_batch_id: batchId,
        }))
      );
      if (histErr) throw histErr;
      superseded = existing.length;

      // The live rows are then deleted so the new import owns the
      // (site, period, parameter) slot outright. History holds the originals.
      const { error: delErr } = await supabaseAdmin
        .from("input_value")
        .delete()
        .in("id", existing.map((e) => e.id));
      if (delErr) throw delErr;
    }

    // ---- Write ------------------------------------------------------------
    const now = new Date().toISOString();
    const sourceBase = `${batch.filename}${batch.sheet_name ? ` › ${batch.sheet_name}` : ""}`;
    const enteredBy = body.enteredBy ?? (batch.uploaded_by as string | null) ?? "esg-team";

    const canonicalValues: ParamValues = {};
    const notAvailable = new Set<string>();

    const toInsert = [];
    for (const [key, v] of acc) {
      const parameterId = idByKey.get(key);
      if (!parameterId) continue;
      // A parameter with neither a value nor an NA marker was not filled in.
      if (!v.anyValue && !v.anyNa) continue;

      canonicalValues[key] = v.anyValue ? v.sum : null;
      if (!v.anyValue && v.anyNa) notAvailable.add(key);

      toInsert.push({
        site_id: ctx.site.id,
        period_id: ctx.period.id,
        parameter_id: parameterId,
        value_num: v.anyValue ? v.sum : null,
        is_not_available: !v.anyValue && v.anyNa,
        // Every figure here came out of a spreadsheet, so it is 'imported'
        // regardless of whether a number or text was read.
        provenance: "imported",
        raw_text: v.rawTexts.length ? v.rawTexts.join(" | ") : null,
        // 'BA_ESG_Monthly_Aug_24.xlsx › Aug 24!F13' — the format the schema
        // documents, so a disclosure traces back to a cell.
        source_doc: v.cells.length ? `${sourceBase}!${v.cells.join(",")}` : sourceBase,
        entered_by: enteredBy,
        import_batch_id: batchId,
        updated_at: now,
      });
    }

    if (toInsert.length) {
      const { error: insErr } = await supabaseAdmin
        .from("input_value")
        .upsert(toInsert, { onConflict: "site_id,period_id,parameter_id" });
      if (insErr) throw insErr;
    }

    // ---- Re-validate what was actually stored ------------------------------
    // Re-running here rather than trusting the preview: the reviewer may have
    // edited values since, and the flags must describe what is in the database.
    const [priorValues, anomalyTolerance] = await Promise.all([
      loadPriorValues(ctx.site.id, fiscalYear, monthNo),
      loadAnomalyTolerance(),
    ]);
    const requiredKeys = ctx.fields
      .filter((f) => f.isRequired && f.parameterKey)
      .map((f) => f.parameterKey!);
    const labelsByKey: Record<string, string> = {};
    for (const f of ctx.fields) if (f.parameterKey) labelsByKey[f.parameterKey] = f.label;

    const flags = runValidations({
      values: canonicalValues,
      notAvailable,
      priorValues,
      requiredKeys,
      labelsByKey,
      anomalyTolerance,
    });

    // Replace this month's unacknowledged flags, as the manual save does.
    const { data: existingFlags } = await supabaseAdmin
      .from("data_flag")
      .select("id, rule_code, acknowledged_at")
      .eq("site_id", ctx.site.id)
      .eq("period_id", ctx.period.id);

    const acknowledged = new Set(
      (existingFlags ?? []).filter((f) => f.acknowledged_at).map((f) => f.rule_code as string)
    );
    const staleIds = (existingFlags ?? [])
      .filter((f) => !f.acknowledged_at)
      .map((f) => f.id as number);
    if (staleIds.length) {
      await supabaseAdmin.from("data_flag").delete().in("id", staleIds);
    }

    const flagRows = flags
      .filter((f) => !acknowledged.has(f.ruleCode))
      .map((f) => ({
        site_id: ctx.site.id,
        period_id: ctx.period.id,
        parameter_id: f.parameterKey ? idByKey.get(f.parameterKey) ?? null : null,
        rule_code: f.ruleCode,
        severity: f.severity,
        message: f.message,
      }));
    if (flagRows.length) {
      await supabaseAdmin
        .from("data_flag")
        .upsert(flagRows, { onConflict: "site_id,period_id,rule_code,parameter_id" });
    }

    // ---- Submission stays a draft -----------------------------------------
    // Deliberately does NOT set 'submitted'. An import records figures; a
    // human submits them.
    const { data: sub } = await supabaseAdmin
      .from("site_submission")
      .select("status")
      .eq("site_id", ctx.site.id)
      .eq("period_id", ctx.period.id)
      .maybeSingle();
    if (!sub) {
      await supabaseAdmin
        .from("site_submission")
        .upsert(
          { site_id: ctx.site.id, period_id: ctx.period.id, status: "draft" },
          { onConflict: "site_id,period_id" }
        );
    }

    // ---- Close the batch ---------------------------------------------------
    const { data: prevCommitted } = await supabaseAdmin
      .from("import_batch")
      .select("id")
      .eq("site_id", ctx.site.id)
      .eq("period_id", ctx.period.id)
      .eq("status", "committed")
      .order("committed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabaseAdmin
      .from("import_batch")
      .update({
        status: "committed",
        committed_at: now,
        superseded_batch_id: (prevCommitted?.id as number | null) ?? null,
      })
      .eq("id", batchId);

    const response: CommitResponse = {
      ok: true,
      saved: toInsert.length,
      superseded,
      flags,
      status: sub?.status ?? "draft",
    };
    return json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[entry/import/commit] failed", { siteCode, fiscalYear, monthNo, message });
    return json({ ok: false, error: message }, 500);
  }
}
