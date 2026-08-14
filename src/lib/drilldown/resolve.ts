// The drilldown: one computed number, and everything behind it.
//
// Given a metric at a grain — en.diesel_stationary at (GROUP, FY2024-25 YTD) —
// this assembles the formula chain, the constants with their current values,
// and the full monthly input matrix across every contributing site, so a
// reviewer can see exactly how the figure was reached.
//
// THREE STATES PER CELL, AND THE THIRD IS THE POINT
//
//   filed        an input_value row with a number, however zero
//   filed_na     a row the site explicitly marked Not Available
//   not_filed    NO ROW AT ALL — nobody filed that return
//
// resolve-birla.mjs:277-281 refuses to write anything for a site-month with no
// return, because a zero there would turn "nobody filed" into "a return of
// zero". This module carries that refusal all the way to the UI: not_filed is
// its own state and never renders as 0. Given coverage runs at 8 of 77 FY25
// site-months, most cells in most drilldowns are not_filed, and a grid that
// showed them as zeros would look like a fully-reported portfolio.
//
// SCOPE 3 IS A DIFFERENT SHAPE. s3.* outputs have no esg.formula row — they are
// written directly by resolve-scope3.mjs from the s3_line ledger. A formula
// walk returns nothing for them, so the caller gets hasNoFormula = true and a
// ledger summary instead of an input matrix.

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { expandProvenance, substituteExpression, type DrilldownFormulaRow, type ProvenanceTree } from "@/lib/drilldown/expand";
import { formatFactor } from "@/lib/drilldown/formatFactor";

export type CellState = "filed" | "filed_na" | "not_filed";

export interface InputCell {
  siteCode: string;
  monthNo: number | null;
  monthLabel: string | null;
  state: CellState;
  value: number | null;
  /** The text the number was parsed from, when it was. */
  rawText: string | null;
  provenance: string | null;
  comment: string | null;
}

export interface InputRow {
  key: string;
  label: string;
  unit: string | null;
  /** Sum across every filed cell. Excludes NA and not-filed, which are not zero. */
  total: number;
  filedCount: number;
  naCount: number;
  notFiledCount: number;
  cells: InputCell[];
}

export interface ConstantUsed {
  key: string;
  label: string;
  value: number;
  unit: string | null;
  isAssumption: boolean;
  source: string | null;
  /** When the value last moved, so a stale figure is attributable. */
  updatedAt: string | null;
}

export interface SiteBreakdown {
  siteCode: string;
  siteName: string;
  value: number | null;
  /** False when this site filed nothing for the period — value is null, not 0. */
  filed: boolean;
}

export interface Drilldown {
  outputKey: string;
  label: string;
  unit: string | null;
  siteCode: string;
  fiscalYear: string;
  periodKind: string;
  value: number | null;
  sitesReporting: number | null;
  sitesExpected: number | null;
  /** The formula chain, nearest first. Empty for Scope 3. */
  formulas: ProvenanceTree["nodes"];
  /** The root expression with values substituted, or null if any were missing. */
  workingShown: string | null;
  constants: ConstantUsed[];
  inputs: InputRow[];
  sites: SiteBreakdown[];
  months: { monthNo: number; monthLabel: string }[];
  /** True when the metric comes from the Scope 3 ledger, not the formula DAG. */
  fromLedger: boolean;
  /** Validation warnings raised against contributing submissions. */
  flags: { siteCode: string; monthLabel: string | null; rule: string; severity: string; message: string }[];
  notes: string[];
}

export async function resolveDrilldown(
  outputKey: string,
  siteCode: string,
  fiscalYear: string,
  periodKind: "ytd" | "month" = "ytd"
): Promise<Drilldown> {
  const notes: string[] = [];

  // ---- The metric, the formulas, the dimensions ---------------------------
  const [{ data: params }, { data: formulaRows }, { data: allSites }, { data: periods }] =
    await Promise.all([
      supabaseAdmin.from("output_parameter").select("id, key, label, unit, is_intensity").eq("key", outputKey),
      supabaseAdmin.from("formula").select("output_key, expression, is_active, eval_order, is_assumption, site_filter"),
      supabaseAdmin.from("site").select("id, code, name, is_group, water_stressed, asset_type"),
      supabaseAdmin.from("period").select("id, fiscal_year, period_kind, month_no, month_label").eq("fiscal_year", fiscalYear),
    ]);

  const param = (params ?? [])[0];
  if (!param) throw new Error(`Unknown metric "${outputKey}"`);

  const formulas: DrilldownFormulaRow[] = (formulaRows ?? []).map((f) => ({
    outputKey: f.output_key as string,
    expression: f.expression as string,
    isActive: f.is_active as boolean,
    evalOrder: f.eval_order as number | null,
    isAssumption: f.is_assumption as boolean,
    siteFilter: f.site_filter as string | null,
  }));

  const tree = expandProvenance(formulas, outputKey);
  const fromLedger = tree.hasNoFormula && outputKey.startsWith("s3.");
  if (tree.hasNoFormula && !fromLedger) {
    notes.push(
      `${outputKey} has no active formula, so there is no chain to show. It may have been deactivated.`
    );
  }
  if (fromLedger) {
    notes.push(
      "Scope 3 figures are computed per ledger line by scripts/resolve-scope3.mjs, not from the formula registry, " +
        "so this metric has no formula chain and no monthly input matrix. Its evidence is the ledger."
    );
  }
  if (tree.truncated) notes.push("The formula chain hit its depth cap — it may be incomplete.");

  const months = (periods ?? [])
    .filter((p) => p.period_kind === "month" && p.month_no != null)
    .sort((a, b) => (a.month_no as number) - (b.month_no as number))
    .map((p) => ({ id: p.id as number, monthNo: p.month_no as number, monthLabel: (p.month_label ?? "") as string }));

  const targetPeriod = (periods ?? []).find((p) => p.period_kind === periodKind);
  const site = (allSites ?? []).find((s) => s.code === siteCode);
  if (!site) throw new Error(`Unknown site "${siteCode}"`);

  // ---- The headline value -------------------------------------------------
  let value: number | null = null;
  let sitesReporting: number | null = null;
  let sitesExpected: number | null = null;
  if (targetPeriod) {
    const { data: ov } = await supabaseAdmin
      .from("output_value")
      .select("value_num, sites_reporting, sites_expected")
      .eq("site_id", site.id)
      .eq("period_id", targetPeriod.id)
      .eq("parameter_id", param.id);
    const row = (ov ?? [])[0];
    if (row) {
      value = row.value_num == null ? null : Number(row.value_num);
      sitesReporting = row.sites_reporting as number | null;
      sitesExpected = row.sites_expected as number | null;
    }
  } else {
    notes.push(`No ${periodKind.toUpperCase()} period exists for ${fiscalYear}.`);
  }

  // ---- Which sites contribute --------------------------------------------
  // Mirrors resolve-birla.mjs:325-340. The water-stressed lines sum only sites
  // inside the declared stressed area, and a drilldown that listed every site
  // would misrepresent what the number covers.
  const rootFilter = tree.nodes.find((n) => n.depth === 0)?.siteFilter ?? null;
  const realSites = (allSites ?? []).filter((s) => !s.is_group);
  const contributing = site.is_group
    ? realSites.filter((s) => {
        switch (rootFilter) {
          case "water_stressed":
            return s.water_stressed;
          case "commercial":
            return s.asset_type === "commercial";
          case "residential":
            return s.asset_type === "residential";
          default:
            return true;
        }
      })
    : [site];
  if (site.is_group && rootFilter && rootFilter !== "all") {
    notes.push(
      `This metric sums only ${rootFilter.replace("_", "-")} sites (${contributing.length} of ${realSites.length}), per its formula's site filter.`
    );
  }

  // ---- The input matrix ---------------------------------------------------
  const inputs: InputRow[] = [];
  if (tree.inputKeys.length && months.length) {
    const { data: ips } = await supabaseAdmin
      .from("input_parameter")
      .select("id, key, label, unit")
      .in("key", tree.inputKeys);
    const ipById = new Map((ips ?? []).map((p) => [p.id as number, p]));

    const { data: ivs } = await supabaseAdmin
      .from("input_value")
      .select("site_id, period_id, parameter_id, value_num, is_not_available, raw_text, provenance, comment")
      .in("parameter_id", (ips ?? []).map((p) => p.id as number))
      .in("period_id", months.map((m) => m.id))
      .in("site_id", contributing.map((s) => s.id as number));

    interface FiledValue {
      value_num: number | string | null;
      is_not_available: boolean | null;
      raw_text: string | null;
      provenance: string | null;
      comment: string | null;
    }
    const filedBy = new Map<string, FiledValue>();
    for (const v of ivs ?? []) {
      filedBy.set(`${v.parameter_id}|${v.site_id}|${v.period_id}`, v as unknown as FiledValue);
    }

    for (const ip of ips ?? []) {
      const cells: InputCell[] = [];
      let total = 0;
      let filedCount = 0;
      let naCount = 0;
      let notFiledCount = 0;

      for (const s of contributing) {
        for (const m of months) {
          const hit = filedBy.get(`${ip.id}|${s.id}|${m.id}`);
          if (!hit) {
            notFiledCount++;
            cells.push({
              siteCode: s.code as string,
              monthNo: m.monthNo,
              monthLabel: m.monthLabel,
              state: "not_filed",
              value: null,
              rawText: null,
              provenance: null,
              comment: null,
            });
            continue;
          }
          if (hit.is_not_available) {
            naCount++;
            cells.push({
              siteCode: s.code as string,
              monthNo: m.monthNo,
              monthLabel: m.monthLabel,
              state: "filed_na",
              value: null,
              rawText: (hit.raw_text ?? null) as string | null,
              provenance: (hit.provenance ?? null) as string | null,
              comment: (hit.comment ?? null) as string | null,
            });
            continue;
          }
          const n = hit.value_num == null ? null : Number(hit.value_num);
          if (n != null) {
            total += n;
            filedCount++;
          }
          cells.push({
            siteCode: s.code as string,
            monthNo: m.monthNo,
            monthLabel: m.monthLabel,
            state: "filed",
            value: n,
            rawText: (hit.raw_text ?? null) as string | null,
            provenance: (hit.provenance ?? null) as string | null,
            comment: (hit.comment ?? null) as string | null,
          });
        }
      }

      inputs.push({
        key: ip.key as string,
        label: ip.label as string,
        unit: (ip.unit ?? null) as string | null,
        total: Math.round(total * 1e4) / 1e4,
        filedCount,
        naCount,
        notFiledCount,
        cells,
      });
    }
    void ipById;
  }

  // ---- Constants, with their current values -------------------------------
  const constants: ConstantUsed[] = [];
  if (tree.constantKeys.length) {
    const { data: cs } = await supabaseAdmin
      .from("constant")
      .select("key, label, value, unit, is_assumption, source, updated_at")
      .in("key", tree.constantKeys);
    for (const c of cs ?? []) {
      constants.push({
        key: c.key as string,
        label: c.label as string,
        value: Number(c.value),
        unit: (c.unit ?? null) as string | null,
        isAssumption: Boolean(c.is_assumption),
        source: (c.source ?? null) as string | null,
        updatedAt: (c.updated_at ?? null) as string | null,
      });
    }
    const assumed = constants.filter((c) => c.isAssumption);
    if (assumed.length) {
      notes.push(
        `${assumed.length} of ${constants.length} constants behind this figure are still unconfirmed assumptions: ${assumed
          .map((c) => c.key)
          .join(", ")}.`
      );
    }
  }

  // ---- Per-site breakdown, for a portfolio figure -------------------------
  const sites: SiteBreakdown[] = [];
  if (site.is_group && targetPeriod) {
    const { data: siteVals } = await supabaseAdmin
      .from("output_value")
      .select("site_id, value_num")
      .eq("period_id", targetPeriod.id)
      .eq("parameter_id", param.id)
      .in("site_id", contributing.map((s) => s.id as number));
    const bySite = new Map((siteVals ?? []).map((v) => [v.site_id as number, v.value_num]));
    for (const s of contributing) {
      const hit = bySite.get(s.id as number);
      sites.push({
        siteCode: s.code as string,
        siteName: s.name as string,
        value: hit == null ? null : Number(hit),
        filed: hit != null,
      });
    }
  }

  // ---- Substituted working, for the root expression -----------------------
  const root = tree.nodes.find((n) => n.depth === 0);
  let workingShown: string | null = null;
  if (root && targetPeriod) {
    const subs = new Map<string, number | null>();
    for (const c of constants) subs.set(`const:${c.key}`, c.value);
    for (const i of inputs) subs.set(`in:${i.key}`, i.total);
    if (root.outputKeys.length) {
      const { data: ops } = await supabaseAdmin
        .from("output_parameter")
        .select("id, key")
        .in("key", root.outputKeys);
      const { data: ovs } = await supabaseAdmin
        .from("output_value")
        .select("parameter_id, value_num")
        .eq("site_id", site.id)
        .eq("period_id", targetPeriod.id)
        .in("parameter_id", (ops ?? []).map((o) => o.id as number));
      const keyById = new Map((ops ?? []).map((o) => [o.id as number, o.key as string]));
      for (const v of ovs ?? []) {
        const k = keyById.get(v.parameter_id as number);
        if (k) subs.set(`out:${k}`, v.value_num == null ? null : Number(v.value_num));
      }
    }
    // Small factors keep their significant digits. toFixed(4) would render the
    // kWh->GJ conversion 0.0036 as "0.004" and the rupees->crore conversion
    // 1e-7 as "0", making the shown working look like different arithmetic from
    // the one that produced the number.
    workingShown = substituteExpression(root.expression, subs, formatFactor);
  }

  // ---- Validation flags on contributing submissions -----------------------
  const flags: Drilldown["flags"] = [];
  if (months.length) {
    const { data: fl } = await supabaseAdmin
      .from("data_flag")
      .select("site_id, period_id, rule_code, severity, message")
      .in("period_id", months.map((m) => m.id))
      .in("site_id", contributing.map((s) => s.id as number));
    const siteCodeById = new Map((allSites ?? []).map((s) => [s.id as number, s.code as string]));
    const monthById = new Map(months.map((m) => [m.id, m.monthLabel]));
    for (const f of fl ?? []) {
      flags.push({
        siteCode: siteCodeById.get(f.site_id as number) ?? String(f.site_id),
        monthLabel: monthById.get(f.period_id as number) ?? null,
        rule: f.rule_code as string,
        severity: f.severity as string,
        message: f.message as string,
      });
    }
  }

  if (param.is_intensity) {
    notes.push(
      "This is an intensity ratio. Its YTD value is only meaningful at the annual grain — monthly rows divide a month's figure by an annual denominator."
    );
  }

  return {
    outputKey,
    label: param.label as string,
    unit: (param.unit ?? null) as string | null,
    siteCode,
    fiscalYear,
    periodKind,
    value,
    sitesReporting,
    sitesExpected,
    formulas: tree.nodes,
    workingShown,
    constants,
    inputs,
    sites,
    months: months.map((m) => ({ monthNo: m.monthNo, monthLabel: m.monthLabel })),
    fromLedger,
    flags,
    notes,
  };
}
