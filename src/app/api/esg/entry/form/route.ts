// Returns everything the entry screen needs for one (site, period): the site's
// own form layout, any values already saved, the submission state, and open
// data-quality flags.
//
// The form layout is READ FROM THE DATABASE rather than hard-coded, because
// each site files a differently-shaped return and the layouts change over time
// (Aurora revised its form in February 2024). Which layout applies is decided by
// the period's start date against site_form_assignment, so a historic month
// renders in the form it was actually filed under.

import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  EntrySnapshot,
  FormField,
  DataFlag,
  SavedValue,
  SubmissionStatus,
} from "@/lib/siteEntry/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// `dynamic = "force-dynamic"` stops Next PRE-rendering this at build time, but
// it does not stop a fetch layer caching the response. Without an explicit
// no-store the entry screen re-reads a stale snapshot after every save and the
// user sees their own values vanish. Verified against the dev server: repeat
// GETs of the same URL were served in ~15ms without touching the database.
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const siteCode = url.searchParams.get("site");
  const fiscalYear = url.searchParams.get("fy");
  const monthNo = Number(url.searchParams.get("month"));

  if (!siteCode || !fiscalYear || !Number.isInteger(monthNo)) {
    return json({ error: "site, fy and month are required" }, 400);
  }

  try {
    const [{ data: site, error: siteErr }, { data: period, error: periodErr }] =
      await Promise.all([
        supabaseAdmin
          .from("site")
          .select("id, code, name, asset_type, city, region, water_stressed")
          .eq("code", siteCode)
          .single(),
        supabaseAdmin
          .from("period")
          .select("id, fiscal_year, period_kind, month_no, month_label, period_start")
          .eq("fiscal_year", fiscalYear)
          .eq("period_kind", "month")
          .eq("month_no", monthNo)
          .single(),
      ]);

    if (siteErr || !site) return json({ error: `Unknown site '${siteCode}'` }, 404);
    if (periodErr || !period)
      return json({ error: `Unknown period ${fiscalYear} month ${monthNo}` }, 404);

    // Which form applies for this month. A site can have several assignments
    // over time; pick the one whose window contains the period start.
    const periodStart = period.period_start as string;
    const { data: assignments, error: asgErr } = await supabaseAdmin
      .from("site_form_assignment")
      .select("form_id, effective_from, effective_to")
      .eq("site_id", site.id);
    if (asgErr) throw asgErr;

    const applicable = (assignments ?? []).find((a) => {
      const from = a.effective_from as string | null;
      const to = a.effective_to as string | null;
      return (!from || periodStart >= from) && (!to || periodStart <= to);
    });

    if (!applicable) {
      return json(
        {
          error: `No form is assigned to ${site.name} for ${period.month_label} ${fiscalYear}.`,
        },
        404
      );
    }

    const [{ data: form, error: formErr }, { data: fields, error: fieldErr }] =
      await Promise.all([
        supabaseAdmin
          .from("site_form")
          .select("id, code, name, form_ref")
          .eq("id", applicable.form_id)
          .single(),
        supabaseAdmin
          .from("site_form_field")
          .select(
            "id, group_label, row_order, label, form_unit, column_kind, unit_factor, " +
              "aggregate_key, is_form_total, is_required, help_text, notes, " +
              "parameter:parameter_id(key, label, unit, is_memo)"
          )
          .eq("form_id", applicable.form_id)
          .order("row_order"),
      ]);

    if (formErr || !form) throw formErr ?? new Error("form not found");
    if (fieldErr) throw fieldErr;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layoutFields: FormField[] = (fields ?? []).map((f: any) => ({
      fieldId: f.id,
      groupLabel: f.group_label,
      rowOrder: f.row_order,
      label: f.label,
      formUnit: f.form_unit,
      columnKind: f.column_kind,
      parameterKey: f.parameter?.key ?? null,
      parameterLabel: f.parameter?.label ?? null,
      parameterUnit: f.parameter?.unit ?? null,
      unitFactor: Number(f.unit_factor ?? 1),
      aggregateKey: f.aggregate_key,
      isFormTotal: Boolean(f.is_form_total),
      isRequired: Boolean(f.is_required),
      isMemo: Boolean(f.parameter?.is_memo),
      helpText: f.help_text,
      notes: f.notes,
    }));

    // Values already saved for this site-month, plus submission + flags.
    const [{ data: values }, { data: submission }, { data: flags }] =
      await Promise.all([
        supabaseAdmin
          .from("input_value")
          .select(
            "value_num, is_not_available, provenance, raw_text, comment, source_doc, " +
              "parameter:parameter_id(key)"
          )
          .eq("site_id", site.id)
          .eq("period_id", period.id),
        supabaseAdmin
          .from("site_submission")
          .select("status, submitted_by, submitted_at, review_note")
          .eq("site_id", site.id)
          .eq("period_id", period.id)
          .maybeSingle(),
        supabaseAdmin
          .from("data_flag")
          .select("id, rule_code, severity, message, acknowledged_at, parameter:parameter_id(key)")
          .eq("site_id", site.id)
          .eq("period_id", period.id),
      ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const savedValues: SavedValue[] = (values ?? []).map((v: any) => ({
      parameterKey: v.parameter?.key ?? "",
      valueNum: v.value_num === null ? null : Number(v.value_num),
      isNotAvailable: Boolean(v.is_not_available),
      provenance: v.provenance,
      rawText: v.raw_text,
      comment: v.comment,
      sourceDoc: v.source_doc,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openFlags: DataFlag[] = (flags ?? []).map((f: any) => ({
      id: f.id,
      parameterKey: f.parameter?.key ?? null,
      ruleCode: f.rule_code,
      severity: f.severity,
      message: f.message,
      acknowledgedAt: f.acknowledged_at,
    }));

    const snapshot: EntrySnapshot = {
      site: {
        id: site.id as number,
        code: site.code as string,
        name: site.name as string,
        assetType: site.asset_type as "commercial" | "residential" | "group",
        city: (site.city as string | null) ?? null,
        region: (site.region as string | null) ?? null,
        waterStressed: Boolean(site.water_stressed),
      },
      period: {
        id: period.id as number,
        fiscalYear: period.fiscal_year as string,
        monthNo: (period.month_no as number | null) ?? null,
        monthLabel: (period.month_label as string | null) ?? null,
        periodKind: period.period_kind as "month" | "ytd" | "baseline",
      },
      form: {
        formId: form.id as number,
        formCode: form.code as string,
        formName: form.name as string,
        formRef: (form.form_ref as string | null) ?? null,
        fields: layoutFields,
      },
      values: savedValues,
      submission: submission
        ? {
            status: submission.status as SubmissionStatus,
            submittedBy: (submission.submitted_by as string | null) ?? null,
            submittedAt: (submission.submitted_at as string | null) ?? null,
            reviewNote: (submission.review_note as string | null) ?? null,
          }
        : null,
      flags: openFlags,
    };

    return json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[entry/form] failed", { siteCode, fiscalYear, monthNo, message });
    return json({ error: `Could not load the form: ${message}` }, 500);
  }
}
