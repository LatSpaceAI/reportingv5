// Loading what the standard output workbook prints, and deciding each cell's
// state.
//
// THE ONE RULE THIS MODULE EXISTS TO ENFORCE
//
// A cell's state is decided by WHETHER A ROW EXISTS, never by the number in it.
// resolve-birla.mjs:223 does `if (!inputs) continue;` — a site-month with no
// filed return produces NO output_value row at all, not a zero. So:
//
//   row absent            -> "not filed"      (grey italic text)
//   row present, any value -> the number      (including a real 0)
//
// `value ?? 0` appears nowhere here, and a test sweeps the finished workbook to
// prove no NOT-FILED row carries a numeric 0.
//
// AGGREGATION, AND WHY IT IS DISCLOSED
//
// 23 waste parameters are declared quarterly and 3 air parameters half-yearly,
// but esg.period permits only ('month','ytd','baseline') — so those grains do
// not exist and cannot be read. This module sums the constituent months and
// reports HOW MANY of them were filed, because at ~10% coverage most quarters
// rest on one month or none, and a figure that looks like a quarter while
// covering one month is the misreading most likely to matter.

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  HALF_MONTHS,
  MONTH_LABELS,
  QUARTER_MONTHS,
  type CellState,
  type Frequency,
  type OutputParameter,
} from "./outputLayout";

export interface SiteRow {
  id: number;
  code: string;
  name: string;
  assetType: string;
  region: string | null;
  waterStressed: boolean;
  isGroup: boolean;
}

export interface Cell {
  state: CellState;
  value: number | null;
  /** Filed months backing an aggregated figure, e.g. 1 of 3. */
  monthsFiled?: number;
  monthsInPeriod?: number;
  sitesReporting?: number | null;
  sitesExpected?: number | null;
}

export interface LoadedModel {
  fiscalYear: string;
  sites: SiteRow[];
  parameters: OutputParameter[];
  /** Parameters whose formula is a literal '0' AND flagged an assumption. */
  notComputableKeys: Set<string>;
  /** Parameters restricted to water-stressed sites by formula.site_filter. */
  stressedOnlyKeys: Set<string>;
  /** (siteId|monthNo) that have a filed, resolved return. */
  filedSiteMonths: Set<string>;
  /** Values at month grain: key -> siteId -> monthNo -> row. */
  monthly: Map<string, Map<number, Map<number, { value: number | null; sitesReporting: number | null; sitesExpected: number | null }>>>;
  /** Values at ytd grain: key -> siteId -> row. */
  annual: Map<string, Map<number, { value: number | null; sitesReporting: number | null; sitesExpected: number | null }>>;
  coverage: { siteMonthsFiled: number; siteMonthsExpected: number };
  constants: {
    key: string;
    category: string;
    label: string;
    value: number;
    unit: string | null;
    source: string | null;
    sourceDate: string | null;
    isAssumption: boolean;
    notes: string | null;
    usedBy: string[];
  }[];
  assumptionFormulas: {
    outputKey: string;
    label: string | null;
    unit: string | null;
    expression: string;
    description: string | null;
    sourceRef: string | null;
  }[];
  openFlags: { site: string; period: string; ruleCode: string; message: string }[];
  generatedAt: string;
}

export async function loadOutputModel(fiscalYear: string): Promise<LoadedModel> {
  const [
    { data: siteRows },
    { data: paramRows },
    { data: periodRows },
    { data: formulaRows },
    { data: constantRows },
  ] = await Promise.all([
    supabaseAdmin
      .from("site")
      .select("id, code, name, asset_type, region, water_stressed, is_group")
      .order("code"),
    supabaseAdmin
      .from("output_parameter")
      .select("id, key, domain, scope, label, unit, frequency, is_intensity, sort_order, notes")
      .order("sort_order"),
    supabaseAdmin
      .from("period")
      .select("id, period_kind, month_no, month_label, fiscal_year")
      .eq("fiscal_year", fiscalYear),
    supabaseAdmin
      .from("v_formula_catalogue")
      .select("*"),
    supabaseAdmin.from("v_constant_settings").select("*").order("category").order("key"),
  ]);

  const sites: SiteRow[] = (siteRows ?? []).map((s) => ({
    id: s.id as number,
    code: s.code as string,
    name: s.name as string,
    assetType: (s.asset_type as string) ?? "",
    region: (s.region as string) ?? null,
    waterStressed: Boolean(s.water_stressed),
    isGroup: Boolean(s.is_group),
  }));

  const parameters: OutputParameter[] = (paramRows ?? []).map((p) => {
    // An intensity output must be re-derived, not summed or column-totalled
    // (resolve-birla.mjs:318-333 says so itself).
    //
    // THIS USED TO THROW UNCONDITIONALLY, because no intensity parameter existed
    // and summing a ratio is invalid. Scope 3 seeds one — s3.share_of_footprint
    // — so the throw has become a RULE rather than a refusal:
    //
    //   frequency 'annual'  -> SAFE. resolveCell reads the YTD row directly and
    //                          performs no aggregation at all (see its `grain
    //                          === "annual"` branch), so the ratio is written
    //                          exactly as the resolver derived it.
    //
    //   anything else       -> STILL THROWS. A monthly or quarterly ratio would
    //                          hit the quarter/half aggregation path, which sums
    //                          its constituent months. Summing twelve ratios
    //                          gives a number with no meaning, and it would look
    //                          entirely plausible in the sheet.
    //
    // The column-total row is guarded separately at the point it is written.
    if (p.is_intensity && p.frequency !== "annual") {
      throw new Error(
        `Output parameter ${p.key} is an intensity ratio at ${p.frequency} frequency. ` +
          `Quarter and half-year aggregation SUM their constituent months, which is ` +
          `invalid for a ratio. Either seed it as 'annual' (read straight off the YTD ` +
          `row, no aggregation) or add an explicit re-derivation rule here first.`
      );
    }
    return {
      key: p.key as string,
      domain: p.domain as string,
      scope: (p.scope as string) ?? null,
      label: p.label as string,
      unit: (p.unit as string) ?? null,
      frequency: (p.frequency as Frequency) ?? "monthly",
      sortOrder: (p.sort_order as number) ?? null,
      notes: (p.notes as string) ?? null,
    };
  });

  const paramIdByKey = new Map((paramRows ?? []).map((p) => [p.key as string, p.id as number]));
  const paramKeyById = new Map((paramRows ?? []).map((p) => [p.id as number, p.key as string]));

  const monthPeriods = (periodRows ?? []).filter((p) => p.period_kind === "month");
  const ytdPeriod = (periodRows ?? []).find((p) => p.period_kind === "ytd") ?? null;
  const monthNoByPeriodId = new Map(
    monthPeriods.map((p) => [p.id as number, p.month_no as number])
  );

  // ---- Values -------------------------------------------------------------
  const periodIds = [
    ...monthPeriods.map((p) => p.id as number),
    ...(ytdPeriod ? [ytdPeriod.id as number] : []),
  ];

  const valueRows = periodIds.length ? await selectAllValues(periodIds) : [];

  const monthly: LoadedModel["monthly"] = new Map();
  const annual: LoadedModel["annual"] = new Map();

  for (const v of valueRows) {
    const key = paramKeyById.get(v.parameter_id as number);
    if (!key) continue;
    const row = {
      value: v.value_num == null ? null : Number(v.value_num),
      sitesReporting: v.sites_reporting == null ? null : Number(v.sites_reporting),
      sitesExpected: v.sites_expected == null ? null : Number(v.sites_expected),
    };

    if (ytdPeriod && v.period_id === ytdPeriod.id) {
      if (!annual.has(key)) annual.set(key, new Map());
      annual.get(key)!.set(v.site_id as number, row);
      continue;
    }

    const monthNo = monthNoByPeriodId.get(v.period_id as number);
    if (monthNo == null) continue;
    if (!monthly.has(key)) monthly.set(key, new Map());
    const bySite = monthly.get(key)!;
    if (!bySite.has(v.site_id as number)) bySite.set(v.site_id as number, new Map());
    bySite.get(v.site_id as number)!.set(monthNo, row);
  }

  // ---- Which site-months were actually filed ------------------------------
  const { data: submissions } = await supabaseAdmin
    .from("site_submission")
    .select("site_id, period_id, status")
    .in("status", ["submitted", "under_review", "approved"]);

  const filedSiteMonths = new Set<string>();
  for (const s of submissions ?? []) {
    const monthNo = monthNoByPeriodId.get(s.period_id as number);
    if (monthNo != null) filedSiteMonths.add(`${s.site_id}|${monthNo}`);
  }

  const realSites = sites.filter((s) => !s.isGroup);
  const coverage = {
    siteMonthsFiled: filedSiteMonths.size,
    siteMonthsExpected: realSites.length * monthPeriods.length,
  };

  // ---- Not-computable and stressed-only, both derived at runtime ----------
  //
  // STATE 3 NEEDS BOTH CONJUNCTS:
  //   expression = '0' AND is_assumption = true
  //
  // Eight formulas are a literal '0'. Six are waste lines that genuinely cannot
  // be computed (used oil filed in litres against an MT disclosure; batteries and
  // oil filters as counts) and carry is_assumption = true. The other two —
  // wtr.discharged and wtr.ws_discharged — are a SUBSTANTIVE zero: STP water is
  // recycled on site rather than discharged, and wtr.consumption depends on that
  // zero being real to reach its actual figure. Calling those "not computable"
  // would assert a known figure is unknown.
  const notComputableKeys = new Set<string>();
  const stressedOnlyKeys = new Set<string>();
  const assumptionFormulas: LoadedModel["assumptionFormulas"] = [];

  for (const f of formulaRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = f as any;
    const expr = String(row.expression ?? "").trim();
    const isAssumption = Boolean(row.is_assumption);
    const outputKey = String(row.output_key ?? "");

    if (expr === "0" && isAssumption) notComputableKeys.add(outputKey);
    if (row.site_filter === "water_stressed") stressedOnlyKeys.add(outputKey);
    if (isAssumption) {
      assumptionFormulas.push({
        outputKey,
        label: row.output_label ?? null,
        unit: row.unit ?? null,
        expression: expr,
        description: row.description ?? null,
        sourceRef: row.source_ref ?? null,
      });
    }
  }

  // ---- Constants, with what uses them ------------------------------------
  // v_formula_catalogue already exposes a `dependencies` array per formula, so
  // the constant -> outputs map comes straight off it. No join, and no second
  // read of formula_dependency that could disagree with the view.
  const usedByConstant = new Map<string, string[]>();
  for (const f of formulaRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = f as any;
    const outKey = String(row.output_key ?? "");
    for (const dep of (row.dependencies ?? []) as string[]) {
      // Dependency strings are namespaced as 'const:EF.diesel'.
      if (!String(dep).startsWith("const:")) continue;
      const constKey = String(dep).slice("const:".length);
      const list = usedByConstant.get(constKey) ?? [];
      if (!list.includes(outKey)) list.push(outKey);
      usedByConstant.set(constKey, list);
    }
  }

  const constants: LoadedModel["constants"] = (constantRows ?? []).map((c) => ({
    key: c.key as string,
    category: (c.category_name as string) ?? (c.category as string),
    label: c.label as string,
    value: Number(c.value),
    unit: (c.unit as string) ?? null,
    source: (c.source as string) ?? null,
    sourceDate: (c.source_date as string) ?? null,
    isAssumption: Boolean(c.is_assumption),
    notes: (c.notes as string) ?? null,
    usedBy: usedByConstant.get(c.key as string) ?? [],
  }));

  // ---- Open data flags ---------------------------------------------------
  const { data: flags } = await supabaseAdmin
    .from("v_open_flags")
    .select("*")
    .limit(200);

  const openFlags = (flags ?? []).map((f) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    site: String((f as any).site_name ?? (f as any).site_code ?? ""),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    period: String(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [(f as any).month_label, (f as any).fiscal_year].filter(Boolean).join(" ") || ""
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ruleCode: String((f as any).rule_code ?? ""),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message: String((f as any).message ?? ""),
  }));

  void paramIdByKey;

  return {
    fiscalYear,
    sites,
    parameters,
    notComputableKeys,
    stressedOnlyKeys,
    filedSiteMonths,
    monthly,
    annual,
    coverage,
    constants,
    assumptionFormulas,
    openFlags,
    generatedAt: new Date().toISOString(),
  };
}

/** Pages past PostgREST's 1000-row cap, as the resolver does. */
async function selectAllValues(periodIds: number[]) {
  const pageSize = 1000;
  let from = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = [];
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("output_value")
      .select("site_id, period_id, parameter_id, value_num, sites_reporting, sites_expected")
      .in("period_id", periodIds)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
    from += pageSize;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cell resolution
// ---------------------------------------------------------------------------

/**
 * The state and value of one cell.
 *
 * Order of checks matters. "not applicable" and "not computable" are properties
 * of the PARAMETER and must be decided before row existence, or a stressed-area
 * column on a non-stressed site would read "not filed" — implying a return is
 * missing when none was ever expected.
 */
export function resolveCell(
  model: LoadedModel,
  param: OutputParameter,
  site: SiteRow,
  grain: "month" | "quarter" | "half" | "annual",
  periodIndex: number
): Cell {
  // A stressed-area metric on a site outside the stressed area.
  if (model.stressedOnlyKeys.has(param.key) && !site.isGroup && !site.waterStressed) {
    return { state: "not_applicable", value: null };
  }

  // A disclosure whose input arrives in a unit the model cannot convert.
  if (model.notComputableKeys.has(param.key)) {
    return { state: "not_computable", value: null };
  }

  if (grain === "annual") {
    const row = model.annual.get(param.key)?.get(site.id);
    if (!row) return { state: "not_filed", value: null };
    return {
      state: "value",
      value: row.value,
      sitesReporting: row.sitesReporting,
      sitesExpected: row.sitesExpected,
    };
  }

  const bySite = model.monthly.get(param.key)?.get(site.id);

  if (grain === "month") {
    const row = bySite?.get(periodIndex);
    if (!row) return { state: "not_filed", value: null };
    return {
      state: "value",
      value: row.value,
      sitesReporting: row.sitesReporting,
      sitesExpected: row.sitesExpected,
    };
  }

  // ---- Aggregated grains -------------------------------------------------
  const months =
    grain === "quarter" ? QUARTER_MONTHS[periodIndex] : HALF_MONTHS[periodIndex];

  let sum = 0;
  let found = 0;
  let reporting = 0;
  let expected = 0;

  for (const m of months) {
    const row = bySite?.get(m);
    if (!row) continue;
    found++;
    if (row.value != null) sum += row.value;
    reporting += row.sitesReporting ?? 0;
    expected += row.sitesExpected ?? 0;
  }

  // A period with no constituent month filed is NOT a zero.
  if (found === 0) {
    return { state: "not_filed", value: null, monthsFiled: 0, monthsInPeriod: months.length };
  }

  return {
    state: "value",
    value: sum,
    monthsFiled: found,
    monthsInPeriod: months.length,
    // Coverage is summed across constituent months, matching how the resolver
    // builds its own YTD coverage (resolve-birla.mjs:346-351).
    sitesReporting: reporting,
    sitesExpected: expected,
  };
}

/** True when this site filed anything at all in the period. */
export function returnFiled(
  model: LoadedModel,
  site: SiteRow,
  grain: "month" | "quarter" | "half" | "annual",
  periodIndex: number
): boolean {
  if (site.isGroup) {
    // The portfolio row is a rollup; "filed" means at least one site did.
    return model.filedSiteMonths.size > 0;
  }
  const months =
    grain === "month"
      ? [periodIndex]
      : grain === "quarter"
        ? QUARTER_MONTHS[periodIndex]
        : grain === "half"
          ? HALF_MONTHS[periodIndex]
          : MONTH_LABELS.map((_, i) => i + 1);

  return months.some((m) => model.filedSiteMonths.has(`${site.id}|${m}`));
}
