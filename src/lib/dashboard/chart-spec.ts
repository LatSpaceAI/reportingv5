import { z } from "zod";

/**
 * The contract between the model, the validator, the data fetcher, and the
 * renderer. The model fills out a ChartSpec via the `render_chart` tool; the
 * server validates it against the catalogue, hydrates it into ChartData, and
 * the renderer paints it. Specs are also persisted verbatim as dashboard tiles.
 *
 * plato-v1 extends the vsmev1 spec with a plant dimension: the ESG schema is
 * (plant × period × parameter), so a chart can compare a metric across time for
 * one plant, or across plants for one period.
 */

export const ChartKindSchema = z.enum(["trend", "bar", "kpi", "stacked", "pie"]);
export type ChartKind = z.infer<typeof ChartKindSchema>;

export const GranularitySchema = z.enum(["monthly", "annual"]);
export type Granularity = z.infer<typeof GranularitySchema>;

// "time" → x-axis is months/periods for a single plant.
// "plant" → x-axis is plants for a single period.
export const CompareBySchema = z.enum(["time", "plant"]);
export type CompareBy = z.infer<typeof CompareBySchema>;

export const ChartOptionsSchema = z
  .object({
    color: z.string().optional(),
  })
  .strict();

export const ChartSpecSchema = z
  .object({
    kind: ChartKindSchema,
    title: z.string().min(1).max(120),
    period_code: z.string().min(1).max(60),
    plant_codes: z.array(z.string().min(1)).min(1).max(7),
    parameter_codes: z.array(z.string().min(1)).min(1).max(8),
    granularity: GranularitySchema,
    compare_by: CompareBySchema,
    options: ChartOptionsSchema.optional(),
  })
  .strict();

export type ChartSpec = z.infer<typeof ChartSpecSchema>;

export interface ChartSeriesPoint {
  label: string; // "Apr", "Aurora", "YTD", etc.
  value: number | null;
}

export interface ChartSeries {
  code: string; // unique key used as the Recharts dataKey
  display_name: string;
  unit: string;
  points: ChartSeriesPoint[];
}

/**
 * How much filed evidence a chart's figures rest on.
 *
 * Reported as the WEAKEST coverage of any cell in the chart — a series is only
 * as trustworthy as its thinnest point, and averaging would hide exactly the
 * months worth knowing about. Absent for charts built purely from raw entered
 * inputs, where coverage is not a meaningful property.
 */
export interface ChartCoverage {
  sitesReporting: number;
  sitesExpected: number;
}

/**
 * Why a chart came back with nothing in it.
 *
 * An empty chart is ambiguous in exactly the way that matters: "nobody filed
 * this yet" and "you asked for something this model cannot answer" look
 * identical on screen, and the second is a bug the user should be able to see.
 * The fetcher knows which it was; carrying the reason up means the tile can say
 * so instead of rendering a blank panel.
 */
export interface ChartEmptyReason {
  kind:
    | "input_on_group" // raw inputs are per-site; GROUP has no rows by design
    | "no_values" // parameters/periods are real, nothing filed there yet
    | "unknown_site"
    | "unknown_parameter";
  message: string;
  /** Sites that DO hold data for this request, when we can suggest them. */
  suggested_sites?: string[];
}

export interface ChartData {
  period_label: string;
  series: ChartSeries[];
  coverage?: ChartCoverage;
  /** Present only when every point came back null. */
  empty_reason?: ChartEmptyReason;
}

/**
 * Stable identity for a spec, used to dedupe "already pinned" charts in the UI.
 * Order-insensitive over the code arrays.
 */
export function specKey(spec: ChartSpec): string {
  const plants = [...spec.plant_codes].sort().join(",");
  const params = [...spec.parameter_codes].sort().join(",");
  return [
    spec.kind,
    spec.period_code,
    spec.granularity,
    spec.compare_by,
    plants,
    params,
  ].join("|");
}
