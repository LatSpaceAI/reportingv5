// Saves one month of a site's return.
//
// The client posts values keyed by FORM FIELD id; this route resolves them to
// canonical input parameters, which is where three things happen that the UI
// must not be trusted to do on its own:
//
//   1. Unit conversion. The form says Ltrs, the model stores kL. The multiplier
//      lives on the field row, so the browser cannot get it wrong or drift.
//   2. Aggregation. Several form rows can feed one parameter (Aurora's Level 8
//      + Level 13; DG1..DG4 hours). Rows sharing an aggregate_key are summed.
//   3. Validation. Rules run server-side over the resolved canonical values and
//      are persisted as flags. They never block the save — see validation.ts.

import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runValidations, type ParamValues } from "@/lib/siteEntry/validation";
import type {
  SaveEntryRequest,
  SaveEntryResponse,
  EntryValue,
} from "@/lib/siteEntry/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Parse the user's typed string into a number, or null. */
function toNumber(raw: string): number | null {
  const cleaned = (raw ?? "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: SaveEntryRequest;
  try {
    body = (await req.json()) as SaveEntryRequest;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { siteCode, fiscalYear, monthNo } = body;
  if (!siteCode || !fiscalYear || !Number.isInteger(monthNo)) {
    return json({ error: "siteCode, fiscalYear and monthNo are required" }, 400);
  }
  if (!body.values || typeof body.values !== "object") {
    return json({ error: "values is required" }, 400);
  }

  try {
    const [{ data: site, error: siteErr }, { data: period, error: periodErr }] =
      await Promise.all([
        supabaseAdmin.from("site").select("id, code, name").eq("code", siteCode).single(),
        supabaseAdmin
          .from("period")
          .select("id, month_label, fiscal_year")
          .eq("fiscal_year", fiscalYear)
          .eq("period_kind", "month")
          .eq("month_no", monthNo)
          .single(),
      ]);
    if (siteErr || !site) return json({ error: `Unknown site '${siteCode}'` }, 404);
    if (periodErr || !period) return json({ error: "Unknown period" }, 404);

    // Resolve the posted field ids to their parameter, unit factor and
    // aggregate key. Fetching by id keeps the browser from asserting a mapping.
    const fieldIds = Object.keys(body.values)
      .map(Number)
      .filter((n) => Number.isInteger(n));
    if (fieldIds.length === 0) return json({ error: "No values to save" }, 400);

    const { data: fields, error: fieldErr } = await supabaseAdmin
      .from("site_form_field")
      .select("id, parameter_id, unit_factor, aggregate_key, label, form_unit")
      .in("id", fieldIds);
    if (fieldErr) throw fieldErr;

    // Accumulate canonical values. Rows sharing an aggregate_key sum together;
    // a parameter is "not available" only when EVERY contributing row is.
    const acc = new Map<
      number,
      {
        sum: number;
        anyValue: boolean;
        /** At least one contributing row was explicitly marked NA by the site. */
        anyNa: boolean;
        /** At least one contributing row had something in it (value or text). */
        anyTouched: boolean;
        rawTexts: string[];
        comments: string[];
      }
    >();

    for (const f of fields ?? []) {
      const paramId = f.parameter_id as number | null;
      if (!paramId) continue; // captured but not consolidated (agency, remarks)

      const entry = body.values[String(f.id)] as EntryValue | undefined;
      if (!entry) continue;

      const factor = Number(f.unit_factor ?? 1);
      const parsed = toNumber(entry.raw);
      const isNa = Boolean(entry.notAvailable);

      const current =
        acc.get(paramId) ??
        { sum: 0, anyValue: false, anyNa: false, anyTouched: false, rawTexts: [], comments: [] };

      if (isNa) {
        // The site wrote "NA"/"Nil" — a positive statement that no figure
        // exists, which is NOT the same as a row nobody has filled in yet.
        current.anyNa = true;
        current.anyTouched = true;
      } else if (parsed !== null) {
        current.sum += parsed * factor;
        current.anyValue = true;
        current.anyTouched = true;
      } else if (entry.raw?.trim()) {
        // Unparseable text on a row that isn't marked NA — kept as raw_text.
        current.anyTouched = true;
      }

      if (entry.rawText?.trim()) current.rawTexts.push(entry.rawText.trim());
      else if (!isNa && entry.raw?.trim() && parsed === null)
        current.rawTexts.push(entry.raw.trim());

      if (entry.comment?.trim()) current.comments.push(entry.comment.trim());
      acc.set(paramId, current);
    }

    if (acc.size === 0) return json({ error: "No mappable values to save" }, 400);

    const now = new Date().toISOString();
    // Rows nobody touched are skipped entirely rather than written as nulls, so
    // "not filled in yet" stays distinguishable from "the site said NA".
    const rows = [...acc.entries()]
      .filter(([, v]) => v.anyTouched)
      .map(([parameterId, v]) => ({
        site_id: site.id,
        period_id: period.id,
        parameter_id: parameterId,
        value_num: v.anyValue ? v.sum : null,
        // Only claim not-available when the site actually said so and no
        // contributing row carried a figure.
        is_not_available: !v.anyValue && v.anyNa,
        // A number the user typed is 'entered'; one we read out of their text
        // is 'parsed', and raw_text keeps the original for audit.
        provenance: v.rawTexts.length > 0 ? "parsed" : "entered",
        raw_text: v.rawTexts.length ? v.rawTexts.join(" | ") : null,
        comment: v.comments.length ? v.comments.join(" | ") : null,
        source_doc: body.sourceDoc ?? null,
        entered_by: body.enteredBy ?? "esg-team",
        updated_at: now,
      }));

    if (rows.length > 0) {
      const { error: upsertErr } = await supabaseAdmin
        .from("input_value")
        .upsert(rows, { onConflict: "site_id,period_id,parameter_id" });
      if (upsertErr) throw upsertErr;
    }

    // ---- Validation over the resolved canonical values ----------------------
    const { data: paramRows } = await supabaseAdmin
      .from("input_parameter")
      .select("id, key")
      .in("id", [...acc.keys()]);
    const keyById = new Map((paramRows ?? []).map((p) => [p.id as number, p.key as string]));

    const canonical: ParamValues = {};
    const notAvailable = new Set<string>();
    for (const [paramId, v] of acc) {
      const key = keyById.get(paramId);
      if (!key || !v.anyTouched) continue;
      canonical[key] = v.anyValue ? v.sum : null;
      if (!v.anyValue && v.anyNa) notAvailable.add(key);
    }

    const flags = runValidations({ values: canonical, notAvailable });

    // Replace this month's auto-raised flags with the current set, leaving any
    // that a reviewer has already acknowledged untouched.
    const { data: existing } = await supabaseAdmin
      .from("data_flag")
      .select("id, rule_code, acknowledged_at")
      .eq("site_id", site.id)
      .eq("period_id", period.id);

    const acknowledged = new Set(
      (existing ?? []).filter((f) => f.acknowledged_at).map((f) => f.rule_code as string)
    );
    const staleIds = (existing ?? [])
      .filter((f) => !f.acknowledged_at)
      .map((f) => f.id as number);
    if (staleIds.length) {
      await supabaseAdmin.from("data_flag").delete().in("id", staleIds);
    }

    const flagRows = flags
      .filter((f) => !acknowledged.has(f.ruleCode))
      .map((f) => ({
        site_id: site.id,
        period_id: period.id,
        parameter_id: f.parameterKey
          ? ([...keyById.entries()].find(([, k]) => k === f.parameterKey)?.[0] ?? null)
          : null,
        rule_code: f.ruleCode,
        severity: f.severity,
        message: f.message,
      }));
    if (flagRows.length) {
      await supabaseAdmin
        .from("data_flag")
        .upsert(flagRows, { onConflict: "site_id,period_id,rule_code,parameter_id" });
    }

    // ---- Submission state ---------------------------------------------------
    const status = body.status ?? "draft";
    const submissionRow: Record<string, unknown> = {
      site_id: site.id,
      period_id: period.id,
      status,
    };
    if (status === "submitted") {
      submissionRow.submitted_by = body.enteredBy ?? "esg-team";
      submissionRow.submitted_at = now;
    }
    const { error: subErr } = await supabaseAdmin
      .from("site_submission")
      .upsert(submissionRow, { onConflict: "site_id,period_id" });
    if (subErr) throw subErr;

    const response: SaveEntryResponse = {
      saved: rows.length,
      flags,
      status,
    };
    return json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[entry/save] failed", { siteCode, fiscalYear, monthNo, message });
    return json({ error: `Could not save: ${message}` }, 500);
  }
}
