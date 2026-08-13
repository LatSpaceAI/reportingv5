import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The dashboard catalogue: the curated set of metrics, sites, and periods the
 * model is allowed to reference. Injected (as text) into the model's prompt so
 * it can only pick codes that actually exist — the model never writes SQL.
 *
 * Built from the Birla Estates `esg` schema:
 *   - parameters: esg.output_parameter (computed metrics) + a chartable subset
 *     of esg.input_parameter (raw numeric inputs).
 *   - sites:      esg.site
 *   - periods:    esg.period, with a synthesized stable `code`
 *
 * Single-tenant, so a single process-wide cache (no org key).
 *
 * NAMING: the ChartSpec wire format calls this dimension "plant" because that
 * vocabulary is persisted in saved dashboard tiles and the model-facing tool
 * schema; renaming it would invalidate every stored tile. The catalogue type is
 * `CataloguePlant` for the same reason. The underlying table is `site`.
 */

export type ParamKind = "output" | "input";

export interface CatalogueParam {
  code: string; // == esg.*_parameter.key
  display_name: string;
  unit: string;
  domain: string;
  scope: string | null;
  is_intensity: boolean;
  kind: ParamKind;
  /**
   * Whether any non-null value exists for this parameter anywhere.
   *
   * A parameter row is a DEFINITION; it says the metric exists in the model,
   * not that anybody has filed a number for it. 14 of the 74 output parameters
   * (every s3.*, ghg.total_all_scopes) are defined-but-unpopulated because the
   * Scope 3 resolver has not been run. Offering those to the model as if they
   * were chartable produces a confidently-empty chart with no explanation,
   * which reads as a broken dashboard rather than as missing data.
   */
  has_data: boolean;
}

export interface CataloguePlant {
  code: string;
  name: string;
  is_group: boolean;
  /** 'commercial' (operating building), 'residential' (under construction), 'group'. */
  asset_type?: string;
  city?: string | null;
  /** Inside the BRSR-declared water-stressed area ("Bangalore & NCR"). */
  water_stressed?: boolean;
  /** Whether any computed value exists for this site. See CatalogueParam.has_data. */
  has_data: boolean;
}

export interface CataloguePeriod {
  code: string; // synthesized: "<fiscal_year>:<period_kind>[:<month_no>]"
  label: string;
  fiscal_year: string;
  period_kind: "month" | "ytd" | "baseline";
  month_no: number | null;
  is_current: boolean;
  /** Whether any computed value exists in this period. See CatalogueParam.has_data. */
  has_data: boolean;
  /**
   * How many distinct sites have filed data in this period's fiscal year.
   * Drives the "current period" choice: the newest year that merely EXISTS is
   * usually near-empty, so anchoring there makes every default chart blank.
   */
  sites_with_data: number;
}

export interface DashboardCatalogue {
  parameters: CatalogueParam[];
  plants: CataloguePlant[];
  periods: CataloguePeriod[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; value: DashboardCatalogue } | null = null;

/**
 * PostgREST caps every response at a server-configured maximum (1000 rows on
 * this project) REGARDLESS of `.limit()`. A `.limit(5000)` silently returns
 * 1000 and reports no error, so any "scan the value table" query is quietly
 * partial the moment the table outgrows the cap.
 *
 * Worse, a capped query with no ORDER BY returns an UNSPECIFIED 1000 rows.
 * The previous current-period logic depended on such a query, so which fiscal
 * years it discovered was down to physical row order — stable today, and able
 * to flip to a near-empty year (blanking every default chart) as data grows.
 *
 * Page explicitly with a deterministic order instead.
 */
const PAGE = 1000;

async function pageAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

/**
 * A census of which (parameter, site, period) coordinates actually hold a
 * non-null number, across BOTH value tables.
 *
 * This is what separates "the model defines this metric" from "somebody has
 * filed this metric", which is the distinction the dashboard previously could
 * not make.
 */
interface ValueCensus {
  outputParamIds: Set<number>;
  inputParamIds: Set<number>;
  siteIds: Set<number>;
  periodIds: Set<number>;
  /** period_id -> distinct site_ids present in that period. */
  sitesByPeriod: Map<number, Set<number>>;
}

async function loadValueCensus(): Promise<ValueCensus> {
  const [outRows, inRows] = await Promise.all([
    pageAll<{ parameter_id: number; site_id: number; period_id: number }>(
      (from, to) =>
        supabaseAdmin
          .from("output_value")
          .select("parameter_id, site_id, period_id")
          .not("value_num", "is", null)
          .order("id")
          .range(from, to),
      "census outputs"
    ),
    pageAll<{ parameter_id: number; site_id: number; period_id: number }>(
      (from, to) =>
        supabaseAdmin
          .from("input_value")
          .select("parameter_id, site_id, period_id")
          .not("value_num", "is", null)
          .order("id")
          .range(from, to),
      "census inputs"
    ),
  ]);

  const census: ValueCensus = {
    outputParamIds: new Set(),
    inputParamIds: new Set(),
    siteIds: new Set(),
    periodIds: new Set(),
    sitesByPeriod: new Map(),
  };

  const note = (r: { site_id: number; period_id: number }) => {
    census.siteIds.add(r.site_id);
    census.periodIds.add(r.period_id);
    let s = census.sitesByPeriod.get(r.period_id);
    if (!s) census.sitesByPeriod.set(r.period_id, (s = new Set()));
    s.add(r.site_id);
  };
  for (const r of outRows) {
    census.outputParamIds.add(r.parameter_id);
    note(r);
  }
  for (const r of inRows) {
    census.inputParamIds.add(r.parameter_id);
    note(r);
  }
  return census;
}

/** Stable, human-meaningful period code derived from the period row. */
export function periodCode(p: {
  fiscal_year: string;
  period_kind: string;
  month_no: number | null;
}): string {
  return p.period_kind === "month"
    ? `${p.fiscal_year}:month:${p.month_no}`
    : `${p.fiscal_year}:${p.period_kind}`;
}

export async function loadCatalogue(
  opts: { fresh?: boolean } = {}
): Promise<DashboardCatalogue> {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  const [outputs, inputs, plants, periods, census] = await Promise.all([
    supabaseAdmin
      .from("output_parameter")
      .select("id, key, display:label, unit, domain, scope, is_intensity, sort_order")
      .order("sort_order"),
    supabaseAdmin
      .from("input_parameter")
      .select("id, key, display:label, unit, domain, value_type, is_active, sort_order")
      .eq("is_active", true)
      .eq("value_type", "number")
      .order("sort_order"),
    supabaseAdmin
      .from("site")
      .select("id, code, name, is_group, asset_type, city, water_stressed")
      .order("is_group", { ascending: false })
      .order("code"),
    supabaseAdmin
      .from("period")
      .select("id, fiscal_year, period_kind, month_no, month_label")
      .order("fiscal_year", { ascending: false })
      .order("period_kind")
      .order("month_no"),
    loadValueCensus(),
  ]);

  if (outputs.error) throw new Error(`catalogue outputs: ${outputs.error.message}`);
  if (inputs.error) throw new Error(`catalogue inputs: ${inputs.error.message}`);
  if (plants.error) throw new Error(`catalogue sites: ${plants.error.message}`);
  if (periods.error) throw new Error(`catalogue periods: ${periods.error.message}`);

  const outParams: CatalogueParam[] = (outputs.data ?? []).map((r) => ({
    code: r.key as string,
    display_name: (r.display as string) ?? (r.key as string),
    unit: (r.unit as string) ?? "",
    domain: r.domain as string,
    scope: (r.scope as string | null) ?? null,
    is_intensity: Boolean(r.is_intensity),
    kind: "output" as const,
    has_data: census.outputParamIds.has(r.id as number),
  }));

  // Raw inputs are useful to chart too, but the output catalogue already covers
  // the headline metrics. Include inputs but list them after outputs so the
  // model prefers computed metrics.
  const inParams: CatalogueParam[] = (inputs.data ?? []).map((r) => ({
    code: r.key as string,
    display_name: (r.display as string) ?? (r.key as string),
    unit: (r.unit as string) ?? "",
    domain: r.domain as string,
    scope: null,
    is_intensity: false,
    kind: "input" as const,
    has_data: census.inputParamIds.has(r.id as number),
  }));

  const plantRows: CataloguePlant[] = (plants.data ?? []).map((r) => ({
    code: r.code as string,
    name: r.name as string,
    is_group: Boolean(r.is_group),
    asset_type: (r.asset_type as string) ?? undefined,
    city: (r.city as string | null) ?? null,
    water_stressed: Boolean(r.water_stressed),
    has_data: census.siteIds.has(r.id as number),
  }));

  const periodRows = (periods.data ?? []).map((r) => ({
    id: r.id as number,
    fiscal_year: r.fiscal_year as string,
    period_kind: r.period_kind as "month" | "ytd" | "baseline",
    month_no: (r.month_no as number | null) ?? null,
    month_label: (r.month_label as string | null) ?? null,
  }));

  // How many distinct sites have filed anything in each fiscal year.
  const sitesByFy = new Map<string, Set<number>>();
  for (const p of periodRows) {
    const sites = census.sitesByPeriod.get(p.id);
    if (!sites?.size) continue;
    let acc = sitesByFy.get(p.fiscal_year);
    if (!acc) sitesByFy.set(p.fiscal_year, (acc = new Set()));
    for (const s of sites) acc.add(s);
  }

  // Current period = the YTD row of the best-EVIDENCED fiscal year, else its
  // latest month.
  //
  // "Most recent year that exists" is the wrong rule here: period rows are
  // seeded a year ahead so returns can be filed as they arrive, so the newest
  // fiscal year is typically empty. But "most recent year with ANY row" — the
  // previous rule — is barely better. A part-open year can hold a single site's
  // rows and still win on recency, and the model defaults to whatever is
  // flagged (current), so every unqualified question renders a chart built on
  // one site while a fully-filed prior year sits ignored.
  //
  // Rank by how many sites actually filed, and only break ties by recency. A
  // year must also clear a fraction of the best year's breadth to be eligible
  // at all, so a newly-opened year does not take over the default the moment
  // its first return lands.
  const MIN_BREADTH_RATIO = 0.5;
  const breadth = (fy: string) => sitesByFy.get(fy)?.size ?? 0;
  const yearsWithData = [...sitesByFy.keys()];
  const bestBreadth = yearsWithData.reduce((m, fy) => Math.max(m, breadth(fy)), 0);
  const latestFy =
    yearsWithData
      .filter((fy) => breadth(fy) >= bestBreadth * MIN_BREADTH_RATIO)
      .sort((a, b) => b.localeCompare(a))[0] ??
    // No values anywhere (fresh database): fall back to the newest year that
    // exists so the dashboard still offers a coherent set of periods.
    periodRows.reduce<string | null>(
      (acc, p) => (acc == null || p.fiscal_year > acc ? p.fiscal_year : acc),
      null
    );

  // Prefer a period that actually holds data over one that merely exists.
  const hasVals = (p: { id: number }) => (census.sitesByPeriod.get(p.id)?.size ?? 0) > 0;
  const ofLatest = periodRows.filter((p) => p.fiscal_year === latestFy);
  const ytdOfLatest =
    ofLatest.find((p) => p.period_kind === "ytd" && hasVals(p)) ??
    ofLatest.find((p) => p.period_kind === "ytd");
  const latestMonth = ofLatest
    .filter((p) => p.period_kind === "month" && hasVals(p))
    .sort((a, b) => (b.month_no ?? 0) - (a.month_no ?? 0))[0];
  const currentCode = ytdOfLatest
    ? periodCode(ytdOfLatest)
    : latestMonth
      ? periodCode(latestMonth)
      : null;

  const periodList: CataloguePeriod[] = periodRows.map((p) => {
    const code = periodCode(p);
    const label =
      p.month_label ??
      (p.period_kind === "ytd"
        ? `YTD ${p.fiscal_year}`
        : p.period_kind === "baseline"
          ? `Baseline ${p.fiscal_year}`
          : code);
    return {
      code,
      label: p.period_kind === "month" ? `${label} ${p.fiscal_year}` : label,
      fiscal_year: p.fiscal_year,
      period_kind: p.period_kind,
      month_no: p.month_no,
      is_current: code === currentCode,
      has_data: (census.sitesByPeriod.get(p.id)?.size ?? 0) > 0,
      sites_with_data: sitesByFy.get(p.fiscal_year)?.size ?? 0,
    };
  });

  const value: DashboardCatalogue = {
    parameters: [...outParams, ...inParams],
    plants: plantRows,
    periods: periodList,
  };
  cache = { at: Date.now(), value };
  return value;
}

export function findParam(
  cat: DashboardCatalogue,
  code: string
): CatalogueParam | undefined {
  return cat.parameters.find((p) => p.code === code);
}

export function findPlant(
  cat: DashboardCatalogue,
  code: string
): CataloguePlant | undefined {
  return cat.plants.find((p) => p.code === code);
}

export function findPeriod(
  cat: DashboardCatalogue,
  code: string
): CataloguePeriod | undefined {
  return cat.periods.find((p) => p.code === code);
}

/** Compact text block injected into the model's system prompt. */
export function catalogueToPrompt(cat: DashboardCatalogue): string {
  const lines: string[] = [];

  // Codes with no filed values are listed but explicitly marked, so the model
  // can name the metric when asked about it and still avoid charting a
  // guaranteed-blank tile. Hiding them outright would make the assistant claim
  // a real disclosure doesn't exist.
  lines.push("# Available reporting periods");
  lines.push("Each line: code — label");
  for (const p of cat.periods) {
    const flags = [
      p.is_current ? "current" : null,
      p.has_data ? null : "NO DATA FILED",
    ].filter(Boolean);
    lines.push(`- ${p.code} — ${p.label}${flags.length ? ` (${flags.join("; ")})` : ""}`);
  }
  lines.push("");

  lines.push("# Available sites");
  lines.push("Each line: code — name [type, city] (flags)");
  for (const p of cat.plants) {
    const bits: string[] = [];
    if (p.asset_type && p.asset_type !== "group") bits.push(p.asset_type);
    if (p.city) bits.push(p.city);
    const desc = bits.length ? ` [${bits.join(", ")}]` : "";
    const flags: string[] = [];
    if (p.is_group) flags.push("consolidated portfolio rollup");
    if (p.water_stressed) flags.push("water-stressed area");
    if (!p.has_data) flags.push("NO DATA FILED");
    lines.push(
      `- ${p.code} — ${p.name}${desc}${flags.length ? ` (${flags.join("; ")})` : ""}`
    );
  }
  lines.push(
    "Note: water-stressed metrics (wtr.ws_*) are already rolled up across the " +
      "stressed sites on the GROUP code — do not sum individual sites for them."
  );
  lines.push("");

  lines.push("# Parameter catalogue");
  lines.push("Each line: code | display_name | unit | domain | scope | kind");
  for (const r of cat.parameters) {
    const marks = [r.kind, r.has_data ? null : "NO DATA FILED"]
      .filter(Boolean)
      .join(", ");
    lines.push(
      `- ${r.code} | ${r.display_name} | ${r.unit || "—"} | ${r.domain} | ${r.scope ?? "—"} | ${marks}`
    );
  }
  lines.push("");
  lines.push(
    "IMPORTANT — `input` parameters are RAW FILED READINGS and exist ONLY on " +
      "individual sites. There is no GROUP row for any input parameter: the " +
      "portfolio rollup is computed for `output` parameters only. To chart an " +
      "input metric, name real sites; charting one on GROUP yields an empty " +
      "chart. Prefer the equivalent `output` parameter for portfolio questions."
  );
  lines.push(
    "Anything marked NO DATA FILED has no values in the database. Do not chart " +
      "it — say the metric is defined but not yet populated, and offer the " +
      "closest populated alternative."
  );
  return lines.join("\n");
}
