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
  findPlant,
} from "@/lib/dashboard/catalogue";

/**
 * Turn a validated ChartSpec into ChartData by reading the ESG value tables.
 *
 * No formula evaluation happens here: outputs are pre-computed and stored in
 * esg.output_value by the resolver; raw inputs live in esg.input_value. We read
 * value_num for the relevant (plant, period, parameter) rows.
 *
 * Three shapes, chosen by spec.compare_by / granularity:
 *   - "time" + monthly  → one series per parameter, 12 month points (one plant)
 *   - "plant"           → one series per parameter, one point per plant (one period)
 *   - "annual" (kpi/pie)→ one series per parameter, a single point (one plant/period)
 */

// month_no 1=April … 12=March (Indian fiscal convention).
const MONTH_LABELS = [
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
];

interface PlantRow {
  id: number;
  code: string;
  name: string;
}
interface PeriodRow {
  id: number;
  fiscal_year: string;
  period_kind: string;
  month_no: number | null;
}
interface ParamRow {
  id: number;
  key: string;
}

async function resolvePlants(codes: string[]): Promise<PlantRow[]> {
  const { data, error } = await supabaseAdmin
    .from("plant")
    .select("id, code, name")
    .in("code", codes);
  if (error) throw new Error(`plants: ${error.message}`);
  // Preserve the order the spec asked for.
  const byCode = new Map((data ?? []).map((r) => [r.code as string, r as PlantRow]));
  return codes.map((c) => byCode.get(c)).filter((r): r is PlantRow => !!r);
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

/** Read a single (plant, period, parameter) value, output or input table. */
async function readValue(
  kind: "output" | "input",
  plantId: number,
  periodId: number,
  parameterId: number
): Promise<number | null> {
  const table = kind === "output" ? "output_value" : "input_value";
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("value_num")
    .eq("plant_id", plantId)
    .eq("period_id", periodId)
    .eq("parameter_id", parameterId)
    .maybeSingle();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data?.value_num != null ? Number(data.value_num) : null;
}

export async function fetchChartData(
  spec: ChartSpec,
  cat: DashboardCatalogue
): Promise<ChartData> {
  const period = findPeriod(cat, spec.period_code)!;

  const plants = await resolvePlants(spec.plant_codes);
  const params = await resolveParams(cat, spec.parameter_codes);
  const paramIdByCode = new Map<string, { id: number; kind: "output" | "input" }>();
  for (const p of params.output) paramIdByCode.set(p.key, { id: p.id, kind: "output" });
  for (const p of params.input) paramIdByCode.set(p.key, { id: p.id, kind: "input" });

  const meta = (code: string): CatalogueParam | undefined => findParam(cat, code);

  // ---- compare_by="time": months of the fiscal year for one plant ----------
  if (spec.compare_by === "time" && spec.granularity === "monthly") {
    const plant = plants[0];
    if (!plant) return { period_label: period.label, series: [] };

    // Fetch the 12 month-period ids of this fiscal year.
    const { data: monthRows, error } = await supabaseAdmin
      .from("period")
      .select("id, month_no")
      .eq("fiscal_year", period.fiscal_year)
      .eq("period_kind", "month")
      .order("month_no");
    if (error) throw new Error(`months: ${error.message}`);
    const months = (monthRows ?? []) as { id: number; month_no: number }[];

    const series = await Promise.all(
      spec.parameter_codes.map(async (code) => {
        const p = paramIdByCode.get(code);
        const m = meta(code);
        if (!p || !m) return null;
        const points: ChartSeriesPoint[] = await Promise.all(
          months.map(async (mo) => ({
            label: MONTH_LABELS[(mo.month_no ?? 1) - 1] ?? String(mo.month_no),
            value: await readValue(p.kind, plant.id, mo.id, p.id),
          }))
        );
        return {
          code,
          display_name: m.display_name,
          unit: m.unit,
          points,
        } satisfies ChartSeries;
      })
    );

    return {
      period_label: `${plant.name} · ${period.fiscal_year}`,
      series: series.filter((s): s is ChartSeries => !!s),
    };
  }

  // ---- compare_by="plant": one point per plant, single period --------------
  if (spec.compare_by === "plant") {
    const periodId = await periodIdFor(period);
    const series = await Promise.all(
      spec.parameter_codes.map(async (code) => {
        const p = paramIdByCode.get(code);
        const m = meta(code);
        if (!p || !m) return null;
        const points: ChartSeriesPoint[] = await Promise.all(
          plants.map(async (plant) => ({
            label: plant.name,
            value: await readValue(p.kind, plant.id, periodId, p.id),
          }))
        );
        return {
          code,
          display_name: m.display_name,
          unit: m.unit,
          points,
        } satisfies ChartSeries;
      })
    );
    return {
      period_label: period.label,
      series: series.filter((s): s is ChartSeries => !!s),
    };
  }

  // ---- annual (kpi / pie / single comparison): one point per series --------
  const periodId = await periodIdFor(period);
  const plant = plants[0];
  if (!plant) return { period_label: period.label, series: [] };

  const series = await Promise.all(
    spec.parameter_codes.map(async (code) => {
      const p = paramIdByCode.get(code);
      const m = meta(code);
      if (!p || !m) return null;
      const value = await readValue(p.kind, plant.id, periodId, p.id);
      return {
        code,
        display_name: m.display_name,
        unit: m.unit,
        points: [{ label: period.label, value }],
      } satisfies ChartSeries;
    })
  );

  return {
    period_label:
      plant.code === "GROUP" ? period.label : `${plant.name} · ${period.label}`,
    series: series.filter((s): s is ChartSeries => !!s),
  };
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
