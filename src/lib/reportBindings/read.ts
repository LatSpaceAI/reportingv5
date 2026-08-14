// Resolving report bindings to the numbers they name.
//
// A binding says "this BRSR cell is that metric, at (GROUP, YTD)". This module
// turns that sentence into a value, plus everything the UI needs to be honest
// about what the value is worth.
//
// THREE STATES, NOT TWO. A bound cell is not simply "has a number" or "does
// not". It is:
//
//   value !== null                  resolved — a figure exists for that grain
//   value === null, unresolved      the metric exists but the resolver has
//                                   written no row for that (site, period).
//                                   Almost always: nobody filed a return, so
//                                   no row was written. NOT a zero.
//   stale                           the cell id no longer means what it meant
//                                   when bound (see below)
//
// Collapsing "unresolved" into 0 would reintroduce the exact lie the model is
// built to avoid — resolve-birla.mjs:277-281 refuses to write a zero for a
// site-month nobody filed, and this layer must not undo that at the last step.
//
// STALENESS. Fixed-shape table cells are addressed positionally
// ('C.P6.E6.r0.currentFY' = row INDEX 0). Reordering the rowLabel array in
// brsrSections.ts silently re-points every binding on that question. So each
// binding stored the row label as it read when bound; here we recompute the
// label from the CURRENT schema and compare. A mismatch is surfaced, never
// auto-healed: "the rows moved" and "the label was reworded" produce identical
// mismatches and need opposite responses, so a human decides.

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { quantitativeCells } from "@/lib/quantitativeCells";
import { shiftFiscalYear } from "@/lib/reportBindings/shiftFiscalYear";
import type { Section } from "@/lib/frameworkTypes";

export { shiftFiscalYear };

export interface BoundCell {
  quantCellId: string;
  outputKey: string;
  siteCode: string;
  periodKind: string;
  yearOffset: number;
  /** The metric's own label and unit, from output_parameter. */
  outputLabel: string;
  unit: string | null;
  isIntensity: boolean;
  /** The fiscal year this binding resolved against, after year_offset. */
  fiscalYear: string | null;
  /** null when the resolver wrote no row for this grain — NOT zero. */
  value: number | null;
  /** Why value is null, when it is. */
  unresolvedReason: "no_period" | "no_value" | null;
  sitesReporting: number | null;
  sitesExpected: number | null;
  /** The formula, for the drilldown and for showing the working. */
  formulaExpression: string | null;
  /** The metric rests on a rule, or a constant, the team has not confirmed. */
  isAssumption: boolean;
  note: string | null;
  /** Set when the bound cell's label no longer matches the live schema. */
  staleLabel: { boundAs: string; nowReads: string } | null;
}

interface BindingRow {
  quant_cell_id: string;
  output_key: string;
  site_code: string;
  period_kind: string;
  year_offset: number;
  cell_label: string | null;
  note: string | null;
  output_label: string;
  output_unit: string | null;
  is_intensity: boolean;
  formula_expression: string | null;
  formula_is_assumption: boolean;
  rests_on_assumed_constant: boolean;
}

/**
 * Every bound cell for a framework, resolved against one fiscal year.
 *
 * `sections` is the framework's live schema, used only for staleness detection.
 * Pass it and stale bindings are flagged; omit it and they are not (the values
 * are identical either way).
 */
export async function readBoundCells(
  frameworkId: string,
  fiscalYear: string,
  sections?: Section[]
): Promise<BoundCell[]> {
  const { data: bindings, error } = await supabaseAdmin
    .from("v_report_binding")
    .select(
      "quant_cell_id, output_key, site_code, period_kind, year_offset, cell_label, note, " +
        "output_label, output_unit, is_intensity, formula_expression, " +
        "formula_is_assumption, rests_on_assumed_constant"
    )
    .eq("framework_id", frameworkId);
  if (error) throw new Error(`bindings: ${error.message}`);
  const rows = (bindings ?? []) as unknown as BindingRow[];
  if (rows.length === 0) return [];

  // Live labels, for staleness. Built once.
  const liveLabels = new Map<string, string>();
  if (sections) {
    for (const c of quantitativeCells(sections)) {
      liveLabels.set(c.id, stripFySuffix(c.name));
    }
  }

  // ---- Resolve the periods these bindings need ----------------------------
  // One query for every fiscal year in play, rather than one per binding.
  const wantedYears = new Set<string>();
  for (const b of rows) {
    const fy = shiftFiscalYear(fiscalYear, b.year_offset);
    if (fy) wantedYears.add(fy);
  }

  const { data: periods } = await supabaseAdmin
    .from("period")
    .select("id, fiscal_year, period_kind")
    .in("fiscal_year", [...wantedYears]);

  const periodId = new Map<string, number>();
  for (const p of periods ?? []) {
    periodId.set(`${p.fiscal_year}|${p.period_kind}`, p.id as number);
  }

  const { data: sites } = await supabaseAdmin.from("site").select("id, code");
  const siteId = new Map<string, number>();
  for (const s of sites ?? []) siteId.set(s.code as string, s.id as number);

  const { data: params } = await supabaseAdmin
    .from("output_parameter")
    .select("id, key")
    .in("key", [...new Set(rows.map((b) => b.output_key))]);
  const paramId = new Map<string, number>();
  for (const p of params ?? []) paramId.set(p.key as string, p.id as number);

  // ---- One query for every value ------------------------------------------
  const siteIds = [...new Set([...siteId.values()])];
  const periodIds = [...new Set([...periodId.values()])];
  const paramIds = [...new Set([...paramId.values()])];

  const values = new Map<string, { v: number | null; sr: number | null; se: number | null }>();
  if (siteIds.length && periodIds.length && paramIds.length) {
    const { data: vals, error: vErr } = await supabaseAdmin
      .from("output_value")
      .select("site_id, period_id, parameter_id, value_num, sites_reporting, sites_expected")
      .in("site_id", siteIds)
      .in("period_id", periodIds)
      .in("parameter_id", paramIds);
    if (vErr) throw new Error(`output values: ${vErr.message}`);
    for (const v of vals ?? []) {
      values.set(`${v.site_id}|${v.period_id}|${v.parameter_id}`, {
        v: v.value_num == null ? null : Number(v.value_num),
        sr: v.sites_reporting as number | null,
        se: v.sites_expected as number | null,
      });
    }
  }

  // ---- Assemble ------------------------------------------------------------
  return rows.map((b) => {
    const fy = shiftFiscalYear(fiscalYear, b.year_offset);
    const pid = fy ? periodId.get(`${fy}|${b.period_kind}`) : undefined;
    const sid = siteId.get(b.site_code);
    const parid = paramId.get(b.output_key);

    let value: number | null = null;
    let sitesReporting: number | null = null;
    let sitesExpected: number | null = null;
    let unresolvedReason: BoundCell["unresolvedReason"] = null;

    if (pid == null || sid == null || parid == null) {
      unresolvedReason = "no_period";
    } else {
      const hit = values.get(`${sid}|${pid}|${parid}`);
      if (!hit) {
        unresolvedReason = "no_value";
      } else {
        value = hit.v;
        sitesReporting = hit.sr;
        sitesExpected = hit.se;
        if (value == null) unresolvedReason = "no_value";
      }
    }

    const nowReads = liveLabels.get(b.quant_cell_id);
    const staleLabel =
      b.cell_label && nowReads && nowReads !== b.cell_label
        ? { boundAs: b.cell_label, nowReads }
        : null;

    return {
      quantCellId: b.quant_cell_id,
      outputKey: b.output_key,
      siteCode: b.site_code,
      periodKind: b.period_kind,
      yearOffset: b.year_offset,
      outputLabel: b.output_label,
      unit: b.output_unit,
      isIntensity: b.is_intensity,
      fiscalYear: fy,
      value,
      unresolvedReason,
      sitesReporting,
      sitesExpected,
      formulaExpression: b.formula_expression,
      isAssumption: b.formula_is_assumption || b.rests_on_assumed_constant,
      note: b.note,
      staleLabel,
    };
  });
}

/** "Total Scope 1 emissions … — Current FY" -> "Total Scope 1 emissions …" */
function stripFySuffix(name: string): string {
  return name.replace(/ — (Current|Previous) FY$/, "");
}
