import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  ChartData,
  ChartEmptyReason,
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

/**
 * Roll raw inputs up to the portfolio.
 *
 * esg.input_value holds ONE row per real site — the resolver computes GROUP
 * rollups for output parameters only, deliberately, because a portfolio figure
 * is a property of a computed disclosure rather than of a filed reading. The
 * dashboard did not know that: a chart of any input parameter on GROUP read
 * site_id = GROUP, found nothing, and rendered twelve null points with no
 * indication that the number could never have been there.
 *
 * Summing the filed rows is the honest reconstruction, and it mirrors what the
 * resolver does for outputs (resolve-birla.mjs, "GROUP rollup per month"): sum
 * over the sites that filed, and report how many did. A month where 2 of 11
 * sites filed produces a real sum carrying 2/11 — thin, and visibly so — which
 * is the same contract every other number on this dashboard already honours.
 *
 * Only sums. Intensities and ratios are not additive, so they are left to the
 * output parameters that define them properly.
 */
async function readGroupInputRollup(
  realSiteIds: number[],
  periodIds: number[],
  parameterIds: number[]
): Promise<Map<string, ValueWithCoverage>> {
  const out = new Map<string, ValueWithCoverage>();
  if (!realSiteIds.length || !periodIds.length || !parameterIds.length) return out;

  const { data, error } = await supabaseAdmin
    .from("input_value")
    .select("site_id, period_id, parameter_id, value_num")
    .in("site_id", realSiteIds)
    .in("period_id", periodIds)
    .in("parameter_id", parameterIds);
  if (error) throw new Error(`input_value rollup: ${error.message}`);

  // period|parameter -> running sum plus the set of sites that contributed.
  const acc = new Map<string, { sum: number; sites: Set<number> }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    if (r.value_num == null) continue;
    const k = `${r.period_id}|${r.parameter_id}`;
    let a = acc.get(k);
    if (!a) acc.set(k, (a = { sum: 0, sites: new Set() }));
    a.sum += Number(r.value_num);
    a.sites.add(r.site_id as number);
  }
  for (const [k, a] of acc) {
    const [periodId, parameterId] = k.split("|");
    out.set(`GROUP|${periodId}|${parameterId}`, {
      value: a.sum,
      sitesReporting: a.sites.size,
      sitesExpected: realSiteIds.length,
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

  // Raw inputs have no GROUP row (see readGroupInputRollup). When a chart asks
  // for one on the portfolio, sum the filed site rows instead of reading a
  // site_id that is guaranteed to be absent. Keyed "GROUP|period|param" so the
  // per-shape lookups below can stay uniform.
  const groupSiteIds = sites.filter((s) => s.code === "GROUP").map((s) => s.id);
  const readInputs = async (
    siteIds: number[],
    periodIds: number[]
  ): Promise<Map<string, ValueWithCoverage>> => {
    const direct = await readValues("input", siteIds, periodIds, inputIds);
    if (!groupSiteIds.length || !inputIds.length) return direct;

    const realSiteIds = (
      await resolveSites(cat.plants.filter((p) => !p.is_group).map((p) => p.code))
    ).map((s) => s.id);
    const rolled = await readGroupInputRollup(realSiteIds, periodIds, inputIds);
    for (const gid of groupSiteIds) {
      for (const [k, v] of rolled) direct.set(k.replace(/^GROUP\|/, `${gid}|`), v);
    }
    return direct;
  };

  /**
   * Explain an all-null chart. Called only when nothing came back, so the extra
   * queries here never touch the hot path.
   */
  const diagnose = async (): Promise<ChartEmptyReason | undefined> => {
    const askedGroupOnly = sites.length > 0 && sites.every((s) => s.code === "GROUP");
    const inputCodes = spec.parameter_codes.filter(
      (c) => paramIdByCode.get(c)?.kind === "input"
    );

    if (askedGroupOnly && inputCodes.length === spec.parameter_codes.length) {
      // Every requested parameter is a raw input and the only site asked for is
      // the portfolio. If the rollup above still produced nothing, no site filed
      // these inputs in this period at all.
      return {
        kind: "no_values",
        message:
          `No site has filed ${inputCodes.join(", ")} for ${period.label}. ` +
          "Raw readings are entered per site and rolled up here.",
      };
    }

    if (inputIds.length || outputIds.length) {
      // Which sites DO hold any of these parameters, in any period? A concrete
      // "try these" beats a bare "no data".
      const [outHits, inHits] = await Promise.all([
        outputIds.length
          ? supabaseAdmin
              .from("output_value")
              .select("site_id")
              .in("parameter_id", outputIds)
              .not("value_num", "is", null)
          : Promise.resolve({ data: [], error: null }),
        inputIds.length
          ? supabaseAdmin
              .from("input_value")
              .select("site_id")
              .in("parameter_id", inputIds)
              .not("value_num", "is", null)
          : Promise.resolve({ data: [], error: null }),
      ]);
      const hitIds = new Set<number>([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(((outHits.data ?? []) as any[]).map((r) => r.site_id as number)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(((inHits.data ?? []) as any[]).map((r) => r.site_id as number)),
      ]);
      if (!hitIds.size) {
        return {
          kind: "no_values",
          message:
            `${spec.parameter_codes.join(", ")} is defined in the model but no ` +
            "values have been computed or filed for it yet.",
        };
      }
      const askedIds = new Set(sites.map((s) => s.id));
      if (![...hitIds].some((id) => askedIds.has(id))) {
        const codes = cat.plants
          .filter((p) => p.has_data)
          .map((p) => p.code)
          .filter((c) => !spec.plant_codes.includes(c));
        return {
          kind: "no_values",
          message:
            `No data for ${spec.plant_codes.join(", ")} in ${period.label}, ` +
            "though other sites have filed this metric.",
          suggested_sites: codes.slice(0, 5),
        };
      }
    }

    // The parameter exists at one of the requested sites, just not in this
    // period. Naming a period that DOES hold it turns a dead end into a next
    // step, so find the most recent one.
    const [outWhen, inWhen] = await Promise.all([
      outputIds.length
        ? supabaseAdmin
            .from("output_value")
            .select("period:period_id(fiscal_year, period_kind)")
            .in("parameter_id", outputIds)
            .in("site_id", sites.map((s) => s.id))
            .not("value_num", "is", null)
        : Promise.resolve({ data: [], error: null }),
      inputIds.length
        ? supabaseAdmin
            .from("input_value")
            .select("period:period_id(fiscal_year, period_kind)")
            .in("parameter_id", inputIds)
            .in("site_id", sites.map((s) => s.id))
            .not("value_num", "is", null)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const years = new Set<string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [...((outWhen.data ?? []) as any[]), ...((inWhen.data ?? []) as any[])]
        .map((r) => r.period?.fiscal_year as string | undefined)
        .filter((fy): fy is string => !!fy)
    );
    if (years.size) {
      const list = [...years].sort((a, b) => b.localeCompare(a));
      return {
        kind: "no_values",
        message:
          `Nothing filed for this selection in ${period.label}. ` +
          `This metric has data in ${list.slice(0, 3).join(", ")}.`,
      };
    }

    return {
      kind: "no_values",
      message: `Nothing has been filed for this selection in ${period.label}.`,
    };
  };

  /** Attach an explanation when every point in the chart is null. */
  const finish = async (data: ChartData): Promise<ChartData> => {
    const hasValue = data.series.some((s) => s.points.some((p) => p.value != null));
    if (hasValue || data.series.length === 0) return data;
    return { ...data, empty_reason: await diagnose() };
  };

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
      readInputs([site.id], monthIds),
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

    return finish(
      withCoverage({
        period_label: `${site.name} · ${period.fiscal_year}`,
        series,
      })
    );
  }

  // ---- compare_by="plant": one point per site, single period ---------------
  if (spec.compare_by === "plant") {
    const periodId = await periodIdFor(period);
    const siteIds = sites.map((s) => s.id);

    const [outVals, inVals] = await Promise.all([
      readValues("output", siteIds, [periodId], outputIds),
      readInputs(siteIds, [periodId]),
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

    return finish(withCoverage({ period_label: period.label, series }));
  }

  // ---- annual (kpi / pie / single comparison): one point per series --------
  const periodId = await periodIdFor(period);
  const site = sites[0];
  if (!site) return { period_label: period.label, series: [] };

  const [outVals, inVals] = await Promise.all([
    readValues("output", [site.id], [periodId], outputIds),
    readInputs([site.id], [periodId]),
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

  return finish(
    withCoverage({
      period_label:
        site.code === "GROUP" ? period.label : `${site.name} · ${period.label}`,
      series,
    })
  );
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
