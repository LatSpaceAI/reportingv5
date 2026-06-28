import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The dashboard catalogue: the curated set of metrics, plants, and periods the
 * model is allowed to reference. Injected (as text) into the model's prompt so
 * it can only pick codes that actually exist — the model never writes SQL.
 *
 * Built from plato's `esg` schema:
 *   - parameters: esg.output_parameter (computed metrics) + a chartable subset
 *     of esg.input_parameter (raw numeric inputs).
 *   - plants:     esg.plant
 *   - periods:    esg.period, with a synthesized stable `code`
 *
 * Single-tenant, so a single process-wide cache (no org key).
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
}

export interface CataloguePlant {
  code: string;
  name: string;
  is_group: boolean;
}

export interface CataloguePeriod {
  code: string; // synthesized: "<fiscal_year>:<period_kind>[:<month_no>]"
  label: string;
  fiscal_year: string;
  period_kind: "month" | "ytd" | "baseline";
  month_no: number | null;
  is_current: boolean;
}

export interface DashboardCatalogue {
  parameters: CatalogueParam[];
  plants: CataloguePlant[];
  periods: CataloguePeriod[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; value: DashboardCatalogue } | null = null;

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

  const [outputs, inputs, plants, periods] = await Promise.all([
    supabaseAdmin
      .from("output_parameter")
      .select("key, display:label, unit, domain, scope, is_intensity, sort_order")
      .order("sort_order"),
    supabaseAdmin
      .from("input_parameter")
      .select("key, display:label, unit, domain, value_type, is_active, sort_order")
      .eq("is_active", true)
      .eq("value_type", "number")
      .order("sort_order"),
    supabaseAdmin
      .from("plant")
      .select("code, name, is_group")
      .order("is_group", { ascending: false })
      .order("code"),
    supabaseAdmin
      .from("period")
      .select("fiscal_year, period_kind, month_no, month_label")
      .order("fiscal_year", { ascending: false })
      .order("period_kind")
      .order("month_no"),
  ]);

  if (outputs.error) throw new Error(`catalogue outputs: ${outputs.error.message}`);
  if (inputs.error) throw new Error(`catalogue inputs: ${inputs.error.message}`);
  if (plants.error) throw new Error(`catalogue plants: ${plants.error.message}`);
  if (periods.error) throw new Error(`catalogue periods: ${periods.error.message}`);

  const outParams: CatalogueParam[] = (outputs.data ?? []).map((r) => ({
    code: r.key as string,
    display_name: (r.display as string) ?? (r.key as string),
    unit: (r.unit as string) ?? "",
    domain: r.domain as string,
    scope: (r.scope as string | null) ?? null,
    is_intensity: Boolean(r.is_intensity),
    kind: "output" as const,
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
  }));

  const plantRows: CataloguePlant[] = (plants.data ?? []).map((r) => ({
    code: r.code as string,
    name: r.name as string,
    is_group: Boolean(r.is_group),
  }));

  const periodRows = (periods.data ?? []).map((r) => ({
    fiscal_year: r.fiscal_year as string,
    period_kind: r.period_kind as "month" | "ytd" | "baseline",
    month_no: (r.month_no as number | null) ?? null,
    month_label: (r.month_label as string | null) ?? null,
  }));

  // Current period = the YTD row of the most recent fiscal year if present,
  // else the latest month of the most recent fiscal year.
  const latestFy = periodRows.reduce<string | null>(
    (acc, p) => (acc == null || p.fiscal_year > acc ? p.fiscal_year : acc),
    null
  );
  const ytdOfLatest = periodRows.find(
    (p) => p.fiscal_year === latestFy && p.period_kind === "ytd"
  );
  const latestMonth = periodRows
    .filter((p) => p.fiscal_year === latestFy && p.period_kind === "month")
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

  lines.push("# Available reporting periods");
  lines.push("Each line: code — label");
  for (const p of cat.periods) {
    lines.push(`- ${p.code} — ${p.label}${p.is_current ? " (current)" : ""}`);
  }
  lines.push("");

  lines.push("# Available plants (sites)");
  lines.push("Each line: code — name");
  for (const p of cat.plants) {
    lines.push(`- ${p.code} — ${p.name}${p.is_group ? " (consolidated rollup)" : ""}`);
  }
  lines.push("");

  lines.push("# Parameter catalogue");
  lines.push("Each line: code | display_name | unit | domain | scope");
  for (const r of cat.parameters) {
    lines.push(
      `- ${r.code} | ${r.display_name} | ${r.unit || "—"} | ${r.domain} | ${r.scope ?? "—"}`
    );
  }
  return lines.join("\n");
}
