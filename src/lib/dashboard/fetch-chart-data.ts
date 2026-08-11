import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  ChartData,
  ChartSeries,
  ChartSeriesPoint,
  ChartSpec,
} from "@/lib/dashboard/chart-spec";
import {
  type CatalogueParam,
  type DashboardCatalogue,
  findParam,
  findPeriod,
} from "@/lib/dashboard/catalogue";

/**
 * Turn a validated ChartSpec into ChartData by reading the ESG value tables.
 *
 * No formula evaluation happens here: outputs are pre-computed into
 * esg.output_value by scripts/resolve-birla.mjs; raw inputs live in
 * esg.input_value. We read value_num for the relevant (site, period, parameter)
 * rows.
 *
 * Three shapes, chosen by spec.compare_by / granularity:
 *   - "time" + monthly  -> one series per parameter, 12 month points (one site)
 *   - "plant"           -> one series per parameter, one point per site (one period)
 *   - "annual" (kpi/pie)-> one series per parameter, a single point
 *
 * COVERAGE travels with the data. A portfolio figure for a month where 1 of 11
 * sites filed is arithmetically fine and evidentially thin; the resolver stores
 * sites_reporting / sites_expected on every row and we surface it so the chart
 * can say so rather than presenting a partial total as a complete one.
 *
 * NOTE ON NAMING: the ChartSpec calls the dimension `plant_codes` / compare_by
 * "plant" because that vocabulary is baked into persisted dashboard tiles and
 * the model-facing tool schema. The underlying table is `site`. Renaming the
 * spec would invalidate every saved tile, so the wire format keeps "plant" and
 * the mapping happens here.
 */

// month_no 1=April … 12=March (Indian fiscal convention).
const MONTH_LABELS = [
  "Apr", "May", "Jun", "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
];

interface SiteRow {
  id: number;
  code: string;
  name: string;
}
interface ParamRow {
  id: number;
  key: string;
}

/** A value plus how much of it rests on filed returns. */
interface ValueWithCoverage {
  value: number | null;
  sitesReporting: number | null;
  sitesExpected: number | null;
}

async function resolveSites(codes: string[]): Promise<SiteRow[]> {
  const { data, error } = await supabaseAdmin
    .from("site")
    .select("id, code, name")
    .in("code", codes);
  if (error) throw new Error(`sites: ${error.message}`);
  // Preserve the order the spec asked for.
  const byCode = new Map((data ?? []).map((r) => [r.code as string, r as SiteRow]));
  return codes.map((c) => byCode.get(c)).filter((r): r is SiteRow => !!r);
}

async function resolveParams(
  cat: DashboardCatalogue,
  codes: string[]
): Promise<{ output: ParamRow[]; input: ParamRow[] }> {
  const outputCodes = codes.filter((c) => findParam(cat, c)?.kind === "output");
  const inputCodes = codes.filter((c) => findParam(cat, c)?.kind === "input");

  const [out, inp] = await Promise.all([
    outputCodes.length
      ? supabaseAdmin.from("output_parameter").select("id, key").in("key", outputCodes)
      : Promise.resolve({ data: [], error: null }),
    inputCodes.length
      ? supabaseAdmin.from("input_parameter").select("id, key").in("key", inputCodes)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (out.error) throw new Error(`output params: ${out.error.message}`);
  if (inp.error) throw new Error(`input params: ${inp.error.message}`);
  return {
    output: (out.data ?? []) as ParamRow[],
    input: (inp.data ?? []) as ParamRow[],
  };
}

/**
 * Read every (site, period, parameter) cell a chart needs in ONE query per
 * table, keyed for O(1) lookup.
 *
 * The previous implementation issued a query per cell, so a 12-month chart of
 * three parameters made 36 sequential round-trips. Batching matters more here
 * than it looks: the dashboard renders several tiles at once.
 */
async function readValues(
  kind: "output" | "input",
  siteIds: number[],
  periodIds: number[],
  parameterIds: number[]
): Promise<Map<string, ValueWithCoverage>> {
  const out = new Map<string, ValueWithCoverage>();
  if (!siteIds.length || !periodIds.length || !parameterIds.length) return out;

  const table = kind === "output" ? "output_value" : "input_value";
  // input_value has no coverage columns — coverage is a property of a computed
  // rollup, not of a number somebody typed in.
  const columns =
    kind === "output"
      ? "site_id, period_id, parameter_id, value_num, sites_reporting, sites_expected"
      : "site_id, period_id, parameter_id, value_num";

  const { data, error } = await supabaseAdmin
    .from(table)
    .select(columns)
    .in("site_id", siteIds)
    .in("period_id", periodIds)
    .in("parameter_id", parameterIds);
  if (error) throw new Error(`${table}: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    out.set(`${r.site_id}|${r.period_id}|${r.parameter_id}`, {
      value: r.value_num != null ? Number(r.value_num) : null,
      sitesReporting: r.sites_reporting ?? null,
      sitesExpected: r.sites_expected ?? null,
    });
  }
  return out;
}

export async function fetchChartData(
  spec: ChartSpec,
  cat: DashboardCatalogue
): Promise<ChartData> {
  const period = findPeriod(cat, spec.period_code)!;

  const sites = await resolveSites(spec.plant_codes);
  const params = await resolveParams(cat, spec.parameter_codes);
  const paramIdByCode = new Map<string, { id: number; kind: "output" | "input" }>();
  for (const p of params.output) paramIdByCode.set(p.key, { id: p.id, kind: "output" });
  for (const p of params.input) paramIdByCode.set(p.key, { id: p.id, kind: "input" });

  const meta = (code: string): CatalogueParam | undefined => findParam(cat, code);

  const outputIds = params.output.map((p) => p.id);
  const inputIds = params.input.map((p) => p.id);

  // Coverage is accumulated across every cell the chart reads, then reported as
  // the weakest evidence any figure in it rests on.
  let covReporting: number | null = null;
  let covExpected: number | null = null;
  const noteCoverage = (v: ValueWithCoverage | undefined) => {
    if (!v || v.sitesExpected == null || v.sitesExpected === 0) return;
    const ratio = (v.sitesReporting ?? 0) / v.sitesExpected;
    const current =
      covExpected && covExpected > 0 ? (covReporting ?? 0) / covExpected : Infinity;
    if (ratio < current) {
      covReporting = v.sitesReporting ?? 0;
      covExpected = v.sitesExpected;
    }
  };

  const withCoverage = (data: ChartData): ChartData =>
    covExpected != null
      ? { ...data, coverage: { sitesReporting: covReporting ?? 0, sitesExpected: covExpected } }
      : data;

  // ---- compare_by="time": months of the fiscal year for one site -----------
  if (spec.compare_by === "time" && spec.granularity === "monthly") {
    const site = sites[0];
    if (!site) return { period_label: period.label, series: [] };

    const { data: monthRows, error } = await supabaseAdmin
      .from("period")
      .select("id, month_no")
      .eq("fiscal_year", period.fiscal_year)
      .eq("period_kind", "month")
      .order("month_no");
    if (error) throw new Error(`months: ${error.message}`);
    const months = (monthRows ?? []) as { id: number; month_no: number }[];
    const monthIds = months.map((m) => m.id);

    const [outVals, inVals] = await Promise.all([
      readValues("output", [site.id], monthIds, outputIds),
      readValues("input", [site.id], monthIds, inputIds),
    ]);

    const series = spec.parameter_codes
      .map((code) => {
        const p = paramIdByCode.get(code);
        const m = meta(code);
        if (!p || !m) return null;
        const table = p.kind === "output" ? outVals : inVals;
        const points: ChartSeriesPoint[] = months.map((mo) => {
          const cell = table.get(`${site.id}|${mo.id}|${p.id}`);
          noteCoverage(cell);
          return {
            label: MONTH_LABELS[(mo.month_no ?? 1) - 1] ?? String(mo.month_no),
            value: cell?.value ?? null,
          };
        });
        return { code, display_name: m.display_name, unit: m.unit, points } satisfies ChartSeries;
      })
      .filter((s): s is ChartSeries => !!s);

    return withCoverage({
      period_label: `${site.name} · ${period.fiscal_year}`,
      series,
    });
  }

  // ---- compare_by="plant": one point per site, single period ---------------
  if (spec.compare_by === "plant") {
    const periodId = await periodIdFor(period);
    const siteIds = sites.map((s) => s.id);

    const [outVals, inVals] = await Promise.all([
      readValues("output", siteIds, [periodId], outputIds),
      readValues("input", siteIds, [periodId], inputIds),
    ]);

    const series = spec.parameter_codes
      .map((code) => {
        const p = paramIdByCode.get(code);
        const m = meta(code);
        if (!p || !m) return null;
        const table = p.kind === "output" ? outVals : inVals;
        const points: ChartSeriesPoint[] = sites.map((site) => {
          const cell = table.get(`${site.id}|${periodId}|${p.id}`);
          noteCoverage(cell);
          return { label: site.name, value: cell?.value ?? null };
        });
        return { code, display_name: m.display_name, unit: m.unit, points } satisfies ChartSeries;
      })
      .filter((s): s is ChartSeries => !!s);

    return withCoverage({ period_label: period.label, series });
  }

  // ---- annual (kpi / pie / single comparison): one point per series --------
  const periodId = await periodIdFor(period);
  const site = sites[0];
  if (!site) return { period_label: period.label, series: [] };

  const [outVals, inVals] = await Promise.all([
    readValues("output", [site.id], [periodId], outputIds),
    readValues("input", [site.id], [periodId], inputIds),
  ]);

  const series = spec.parameter_codes
    .map((code) => {
      const p = paramIdByCode.get(code);
      const m = meta(code);
      if (!p || !m) return null;
      const table = p.kind === "output" ? outVals : inVals;
      const cell = table.get(`${site.id}|${periodId}|${p.id}`);
      noteCoverage(cell);
      return {
        code,
        display_name: m.display_name,
        unit: m.unit,
        points: [{ label: period.label, value: cell?.value ?? null }],
      } satisfies ChartSeries;
    })
    .filter((s): s is ChartSeries => !!s);

  return withCoverage({
    period_label:
      site.code === "GROUP" ? period.label : `${site.name} · ${period.label}`,
    series,
  });
}

/** Look up the period id for a catalogue period (which only carries a code). */
async function periodIdFor(period: {
  fiscal_year: string;
  period_kind: string;
  month_no: number | null;
}): Promise<number> {
  let q = supabaseAdmin
    .from("period")
    .select("id")
    .eq("fiscal_year", period.fiscal_year)
    .eq("period_kind", period.period_kind);
  q = period.month_no == null ? q.is("month_no", null) : q.eq("month_no", period.month_no);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`period id: ${error.message}`);
  if (!data) throw new Error(`period not found: ${period.fiscal_year}/${period.period_kind}`);
  return data.id as number;
}
