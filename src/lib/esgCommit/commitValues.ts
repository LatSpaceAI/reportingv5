// Persisting a set of canonical values into input_value, with the four
// guarantees that make an import recoverable.
//
// WHY THIS IS A MODULE AND NOT A ROUTE
//
// There are two ways a spreadsheet reaches this database and there will not be
// a third:
//
//   1. The client's OWN monthly form, matched by fuzzy label against a per-site
//      site_form_field replica (typos preserved, because site teams recognise
//      their own paper). /api/esg/entry/import/commit owns that.
//   2. OUR standard template, matched by an explicit input_parameter.code in a
//      hidden column. /api/esg/entry/import/standard-commit owns that.
//
// The two differ ONLY in how a spreadsheet cell becomes a (parameterKey, value)
// pair. Everything after that — supersession, history, validation, submission
// state, batch closure — is identical, and is the part that must not be
// reimplemented twice. So each path owns MATCHING and this module owns
// PERSISTENCE.
//
// THE FOUR GUARANTEES, all of which live here
//
//   1. Nothing is overwritten silently. If the site-month already holds values
//      the caller must pass overrideExisting; without it this refuses and
//      reports requiresOverride so the UI can show the warning. A second upload
//      of "March" can never quietly replace March.
//
//   2. Nothing is destroyed. Superseded values are copied into
//      input_value_history, pointing at the batch that replaced them, BEFORE
//      the new figures are written. The logbook reads that history, so a
//      mistaken override is visible and recoverable.
//
//   3. Committing does NOT submit. status stays 'draft' until a human submits
//      explicitly — an uploaded file is evidence someone typed something, not
//      evidence anyone checked it. Only submitted returns feed the resolver.
//
//   4. Validation never blocks. Rules run against what was ACTUALLY stored and
//      persist as flags; flags a reviewer already acknowledged survive a
//      re-save.
//
// Extracted verbatim from api/esg/entry/import/commit/route.ts lines 149-356.
// Behaviour is intentionally unchanged — esg:test-import is the gate.

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadPriorValues, loadAnomalyTolerance } from "@/lib/siteEntry/importService";
import { runValidations, type ParamValues } from "@/lib/siteEntry/validation";
import type { DataFlag, SubmissionStatus } from "@/lib/siteEntry/types";

/**
 * One parameter's worth of accumulated input, AFTER the caller has matched
 * cells to parameters and summed any rows that share one.
 *
 * The three states the schema distinguishes are encoded by the two booleans:
 *
 *   anyValue=true            -> a number was read (including a reported 0)
 *   anyValue=false, anyNa=true -> explicitly "not available"
 *   both false               -> not filled in; this module writes NOTHING
 *
 * That last case is why a row absent from the sheet must not arrive here as a
 * zero. Writing 0 would turn "nobody filed" into "a return of zero", which is
 * the most consequential lie this model could tell.
 */
export interface AccumulatedValue {
  sum: number;
  anyValue: boolean;
  anyNa: boolean;
  /** Every raw cell string that fed this parameter, for the audit trail. */
  rawTexts: string[];
  /** Every sheet cell reference that fed it, e.g. ["F13","F14"]. */
  cells: string[];
}

export interface CommitValuesInput {
  siteId: number;
  periodId: number;
  fiscalYear: string;
  monthNo: number;
  /** Human-readable month, for the override message. */
  monthLabel: string | null;
  siteName: string;

  batchId: number;
  /** 'file.xlsx › Sheet' — prefixed onto every source_doc. */
  sourceBase: string;
  enteredBy: string;

  /** Matched, accumulated, keyed by input_parameter.key. */
  values: Map<string, AccumulatedValue>;

  overrideExisting?: boolean;

  /**
   * Parameters that must be present, by key. The client's own forms carry
   * is_required on site_form_field; the standard template has no equivalent
   * (is_required does not exist on input_parameter), so it passes [] and the
   * REQUIRED_FIELD_MISSING rule cannot fire for that path. That is a known,
   * deliberate gap awaiting an ESG-team decision — not an oversight.
   */
  requiredKeys?: string[];
  /** Labels for flag messages, by key. Falls back to the key itself. */
  labelsByKey?: Record<string, string>;

  /**
   * What to say when nothing matched. Supplied by the caller because the two
   * paths fail for different reasons and the message should name the real one:
   * the client's own form failed to match LABELS, the standard template failed
   * to find KEYS. A shared message would misdescribe one of them.
   */
  nothingMappedError?: string;
}

export type CommitValuesResult =
  | {
      ok: true;
      saved: number;
      superseded: number;
      flags: DataFlag[];
      status: SubmissionStatus;
    }
  | { ok: false; requiresOverride: true; error: string }
  | { ok: false; requiresOverride?: false; error: string; unprocessable?: true };

/**
 * Writes `values` into input_value for one (site, period), archiving whatever
 * it replaces.
 *
 * Throws on database errors so the caller maps them to a 500. Returns ok:false
 * for the two conditions that are answers rather than faults: nothing mappable,
 * and existing data without consent to replace it.
 */
export async function commitValues(
  input: CommitValuesInput
): Promise<CommitValuesResult> {
  const {
    siteId,
    periodId,
    fiscalYear,
    monthNo,
    monthLabel,
    siteName,
    batchId,
    sourceBase,
    enteredBy,
    values,
    overrideExisting,
    requiredKeys = [],
    labelsByKey = {},
    nothingMappedError = "Nothing in this file could be mapped to a known parameter.",
  } = input;

  if (values.size === 0) {
    return { ok: false, error: nothingMappedError, unprocessable: true };
  }

  // ---- Resolve parameter ids ------------------------------------------------
  const keys = [...values.keys()];
  const { data: params, error: paramErr } = await supabaseAdmin
    .from("input_parameter")
    .select("id, key")
    .in("key", keys);
  if (paramErr) throw paramErr;
  const idByKey = new Map((params ?? []).map((p) => [p.key as string, p.id as number]));

  // ---- Existing data: refuse to overwrite without explicit consent ---------
  const { data: existingData, error: exErr } = await supabaseAdmin
    .from("input_value")
    .select(
      "id, parameter_id, value_num, is_not_available, provenance, raw_text, comment, " +
        "source_doc, entered_by, entered_at"
    )
    .eq("site_id", siteId)
    .eq("period_id", periodId)
    .is("superseded_at", null);
  if (exErr) throw exErr;
  // This project has no generated Supabase types, so rows from the newer
  // tables come back untyped. Same convention as the export module.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (existingData ?? []) as any[];

  if (existing.length > 0 && !overrideExisting) {
    return {
      ok: false,
      requiresOverride: true,
      error:
        `${siteName} already has ${existing.length} values recorded for ` +
        `${monthLabel ?? `month ${monthNo}`} ${fiscalYear}. ` +
        `Confirm the override to replace them.`,
    };
  }

  // ---- Archive what is being replaced --------------------------------------
  let superseded = 0;
  if (existing.length) {
    const { error: histErr } = await supabaseAdmin.from("input_value_history").insert(
      existing.map((e) => ({
        site_id: siteId,
        period_id: periodId,
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

  // ---- Write ---------------------------------------------------------------
  const now = new Date().toISOString();

  const canonicalValues: ParamValues = {};
  const notAvailable = new Set<string>();

  const toInsert = [];
  for (const [key, v] of values) {
    const parameterId = idByKey.get(key);
    if (!parameterId) continue;
    // A parameter with neither a value nor an NA marker was not filled in.
    if (!v.anyValue && !v.anyNa) continue;

    canonicalValues[key] = v.anyValue ? v.sum : null;
    if (!v.anyValue && v.anyNa) notAvailable.add(key);

    toInsert.push({
      site_id: siteId,
      period_id: periodId,
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

  // ---- Re-validate what was actually stored --------------------------------
  // Re-running here rather than trusting the preview: the reviewer may have
  // edited values since, and the flags must describe what is in the database.
  const [priorValues, anomalyTolerance] = await Promise.all([
    loadPriorValues(siteId, fiscalYear, monthNo),
    loadAnomalyTolerance(),
  ]);

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
    .eq("site_id", siteId)
    .eq("period_id", periodId);

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
      site_id: siteId,
      period_id: periodId,
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

  // ---- Submission stays a draft -------------------------------------------
  // Deliberately does NOT set 'submitted'. An import records figures; a
  // human submits them.
  const { data: sub } = await supabaseAdmin
    .from("site_submission")
    .select("status")
    .eq("site_id", siteId)
    .eq("period_id", periodId)
    .maybeSingle();
  if (!sub) {
    await supabaseAdmin
      .from("site_submission")
      .upsert(
        { site_id: siteId, period_id: periodId, status: "draft" },
        { onConflict: "site_id,period_id" }
      );
  }

  // ---- Close the batch ----------------------------------------------------
  const { data: prevCommitted } = await supabaseAdmin
    .from("import_batch")
    .select("id")
    .eq("site_id", siteId)
    .eq("period_id", periodId)
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

  return {
    ok: true,
    saved: toInsert.length,
    superseded,
    flags,
    status: (sub?.status as SubmissionStatus) ?? "draft",
  };
}

/**
 * Loads and checks the batch a commit is about to consume: it must exist, still
 * be a preview, and belong to this exact site-month. Re-committing a batch
 * would double-supersede and orphan its history.
 *
 * Shared because both commit paths need the identical check, and getting it
 * wrong is silent.
 */
export async function assertCommittableBatch(
  batchId: number,
  siteId: number,
  periodId: number
): Promise<
  | { ok: true; batch: { id: number; filename: string; sheetName: string | null; uploadedBy: string | null } }
  | { ok: false; error: string; status: number }
> {
  const { data: batch, error } = await supabaseAdmin
    .from("import_batch")
    .select("id, site_id, period_id, filename, sheet_name, status, uploaded_by")
    .eq("id", batchId)
    .single();

  if (error || !batch) return { ok: false, error: "Unknown import batch.", status: 404 };
  if (batch.status !== "preview") {
    return { ok: false, error: `That import was already ${batch.status}.`, status: 409 };
  }
  if (batch.site_id !== siteId || batch.period_id !== periodId) {
    return {
      ok: false,
      error: "This import was parsed for a different site or month.",
      status: 409,
    };
  }

  return {
    ok: true,
    batch: {
      id: batch.id as number,
      filename: batch.filename as string,
      sheetName: (batch.sheet_name as string | null) ?? null,
      uploadedBy: (batch.uploaded_by as string | null) ?? null,
    },
  };
}
