import "server-only";

// Server-side services behind the Excel Entry flow.
//
// Split out of the routes so the preview and the commit share ONE definition of
// how a form is resolved and how prior values are found. Two copies of the
// form-resolution rule would eventually disagree about which month uses which
// layout, and that disagreement is precisely the electricity-inversion bug.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FormField } from "./types";
import type { PriorValue } from "./validation";
import { DEFAULT_ANOMALY_TOLERANCE } from "./validation";

export interface ResolvedContext {
  site: { id: number; code: string; name: string };
  period: { id: number; fiscalYear: string; monthNo: number; monthLabel: string | null };
  form: { id: number; code: string; name: string };
  fields: FormField[];
}

/**
 * Resolve the site, period and the form that applied for THAT month.
 *
 * The form is chosen by date, not by site: Aurora files one layout up to
 * January 2024 and a different one from February 2024, and the same row means
 * different things in each. Importing a historic month against the current
 * layout would misclassify it silently.
 */
export async function resolveContext(
  siteCode: string,
  fiscalYear: string,
  monthNo: number
): Promise<ResolvedContext> {
  const [{ data: site, error: siteErr }, { data: period, error: periodErr }] =
    await Promise.all([
      supabaseAdmin.from("site").select("id, code, name").eq("code", siteCode).single(),
      supabaseAdmin
        .from("period")
        .select("id, fiscal_year, month_no, month_label, period_start")
        .eq("fiscal_year", fiscalYear)
        .eq("period_kind", "month")
        .eq("month_no", monthNo)
        .single(),
    ]);

  if (siteErr || !site) throw new Error(`Unknown site '${siteCode}'`);
  if (periodErr || !period) throw new Error(`Unknown period ${fiscalYear} month ${monthNo}`);

  const { data: assignments, error: asgErr } = await supabaseAdmin
    .from("site_form_assignment")
    .select("form_id, effective_from, effective_to")
    .eq("site_id", site.id);
  if (asgErr) throw asgErr;

  const periodStart = period.period_start as string;
  const applicable = (assignments ?? []).find((a) => {
    const from = a.effective_from as string | null;
    const to = a.effective_to as string | null;
    return (!from || periodStart >= from) && (!to || periodStart <= to);
  });
  if (!applicable) {
    throw new Error(
      `No form is assigned to ${site.name} for ${period.month_label ?? monthNo} ${fiscalYear}.`
    );
  }

  const [{ data: form, error: formErr }, { data: fields, error: fieldErr }] =
    await Promise.all([
      supabaseAdmin
        .from("site_form")
        .select("id, code, name")
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
  const layout: FormField[] = (fields ?? []).map((f: any) => ({
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

  return {
    site: { id: site.id as number, code: site.code as string, name: site.name as string },
    period: {
      id: period.id as number,
      fiscalYear: period.fiscal_year as string,
      monthNo: period.month_no as number,
      monthLabel: (period.month_label as string | null) ?? null,
    },
    form: { id: form.id as number, code: form.code as string, name: form.name as string },
    fields: layout,
  };
}

/** Previous fiscal year label: "2024-25" -> "2023-24". */
function priorFiscalYear(fy: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(fy);
  if (!m) return null;
  const start = Number(m[1]) - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/**
 * Find figures to compare this month against, for the ±20% anomaly check.
 *
 * Preference order:
 *   1. The SAME MONTH in the previous fiscal year. Site returns are strongly
 *      seasonal — monsoon water, summer DG load — so comparing April with
 *      April is the only comparison that isolates a genuine change from the
 *      weather.
 *   2. Failing that, the most recent month the site filed. Weaker, and the
 *      flag says so, but with 8 filed site-months in FY25 the prior-year
 *      figure usually does not exist yet and no comparison at all would mean
 *      no anomaly detection for most uploads.
 */
export async function loadPriorValues(
  siteId: number,
  fiscalYear: string,
  monthNo: number
): Promise<Record<string, PriorValue>> {
  const out: Record<string, PriorValue> = {};

  const pfy = priorFiscalYear(fiscalYear);
  if (pfy) {
    const { data: pPeriod } = await supabaseAdmin
      .from("period")
      .select("id, month_label, fiscal_year")
      .eq("fiscal_year", pfy)
      .eq("period_kind", "month")
      .eq("month_no", monthNo)
      .maybeSingle();

    if (pPeriod) {
      const { data: vals } = await supabaseAdmin
        .from("input_value")
        .select("value_num, parameter:parameter_id(key)")
        .eq("site_id", siteId)
        .eq("period_id", pPeriod.id)
        .is("superseded_at", null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const v of (vals ?? []) as any[]) {
        const key = v.parameter?.key;
        if (!key || v.value_num == null) continue;
        out[key] = {
          value: Number(v.value_num),
          basis: "same_month_prior_year",
          periodLabel: `${pPeriod.month_label ?? `month ${monthNo}`} ${pfy}`,
        };
      }
      if (Object.keys(out).length > 0) return out;
    }
  }

  // Fall back to the latest month this site filed before the one being imported.
  const { data: periods } = await supabaseAdmin
    .from("period")
    .select("id, fiscal_year, month_no, month_label, period_start")
    .eq("period_kind", "month")
    .order("period_start", { ascending: false });

  const target = (periods ?? []).find(
    (p) => p.fiscal_year === fiscalYear && p.month_no === monthNo
  );
  if (!target) return out;

  const earlier = (periods ?? []).filter(
    (p) => (p.period_start as string) < (target.period_start as string)
  );
  if (!earlier.length) return out;

  const { data: filled } = await supabaseAdmin
    .from("input_value")
    .select("period_id, value_num, parameter:parameter_id(key)")
    .eq("site_id", siteId)
    .in("period_id", earlier.map((p) => p.id))
    .is("superseded_at", null);

  if (!filled?.length) return out;

  // Newest period among those that actually have values.
  const byPeriod = new Set(filled.map((v) => v.period_id as number));
  const mostRecent = earlier.find((p) => byPeriod.has(p.id as number));
  if (!mostRecent) return out;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const v of filled as any[]) {
    if (v.period_id !== mostRecent.id) continue;
    const key = v.parameter?.key;
    if (!key || v.value_num == null) continue;
    out[key] = {
      value: Number(v.value_num),
      basis: "most_recent_month",
      periodLabel: `${mostRecent.month_label ?? ""} ${mostRecent.fiscal_year}`.trim(),
    };
  }
  return out;
}

/** The ±20% tolerance, from esg.constant so it is tunable without a deploy. */
export async function loadAnomalyTolerance(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("constant")
    .select("value")
    .eq("key", "qa.anomaly_tolerance")
    .maybeSingle();
  const v = data?.value == null ? NaN : Number(data.value);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_ANOMALY_TOLERANCE;
}

/** Values already stored for a site-month, keyed by parameter key. */
export async function loadExistingValues(
  siteId: number,
  periodId: number
): Promise<
  Record<string, { valueNum: number | null; isNotAvailable: boolean; provenance: string }>
> {
  const { data } = await supabaseAdmin
    .from("input_value")
    .select("value_num, is_not_available, provenance, parameter:parameter_id(key)")
    .eq("site_id", siteId)
    .eq("period_id", periodId)
    .is("superseded_at", null);

  const out: Record<
    string,
    { valueNum: number | null; isNotAvailable: boolean; provenance: string }
  > = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const v of (data ?? []) as any[]) {
    const key = v.parameter?.key;
    if (!key) continue;
    out[key] = {
      valueNum: v.value_num == null ? null : Number(v.value_num),
      isNotAvailable: Boolean(v.is_not_available),
      provenance: String(v.provenance ?? "entered"),
    };
  }
  return out;
}

// Site and period pickers are served by the existing /api/esg/entry/sites
// route, which already returns the site list with per-month coverage. The
// Excel Entry screen reuses it rather than adding a second source of truth.
