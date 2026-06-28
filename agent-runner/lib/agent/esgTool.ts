// Supabase ESG database access for the fill agent.
//
// The Supabase `esg` schema is a four-layer carbon-accounting model (see
// supabase/esg/README.md): CONSTANTS, INPUT, FORMULAS, and OUTPUT. For
// "Fill with AI" the agent only ever needs the OUTPUT layer — the already
// computed metrics (Scope 1/2/3, energy, water, waste, KPIs) keyed by
// output_parameter.key and valued per (plant, period) in output_value.
//
// We deliberately expose a SMALL set of read-only, whitelisted query shapes
// instead of raw SQL. The agent cannot run arbitrary statements; it can only
// (a) browse the metric catalogue, (b) read computed values for specific
// metric keys filtered by plant/fiscal-year/period, and (c) list the plant
// and period dimensions. Every query is a parameterised supabase-js select,
// capped in row count. The service-role key reaches the sandbox via env
// (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — never via the job.

import { createClient } from "@supabase/supabase-js";
import { tool } from "@openai/agents";
import { z } from "zod";

const MAX_ROWS = 200;

// createClient with a non-public `db.schema` returns a schema-parameterised
// client type that doesn't unify with the default SupabaseClient generic, so
// we infer the concrete type from the factory call instead of annotating it.
type EsgClient = ReturnType<typeof makeClient>;
let client: EsgClient | null = null;

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env not set (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  // Scope to the `esg` schema so `.from("output_value")` resolves to
  // esg.output_value, mirroring src/lib/supabaseAdmin.ts.
  return createClient(url, key, {
    db: { schema: "esg" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** True when the runtime has the env to reach Supabase. Lets fill.ts decide
 *  whether to register the ESG tools at all. */
export function esgDbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function getClient(): EsgClient {
  if (!client) client = makeClient();
  return client;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Optional callback so the runner can stream a human-readable activity line
// ("Queried ESG database: Scope 2 emissions…") to the client UI.
export interface EsgToolHooks {
  onQuery?: (summary: string) => void;
}

/**
 * Build the read-only ESG database tools. Returns an array suitable for an
 * OpenAI Agent's `tools` option. Caller should only invoke this when
 * esgDbConfigured() is true.
 */
export function createEsgTools(hooks: EsgToolHooks = {}) {
  const note = (s: string) => hooks.onQuery?.(s);

  const listMetrics = tool({
    name: "esg_list_metrics",
    description:
      "Browse the catalogue of computed ESG metrics available in the company's carbon-accounting database (the OUTPUT layer). Use this FIRST to discover which metric keys exist before reading their values. Covers GHG emissions (Scope 1/2/3), energy, fuel, water, waste, biodiversity, air, and production KPIs. Returns each metric's key, label, unit, scope, and domain.",
    parameters: z.object({
      domain: z
        .enum([
          "PRODUCTION",
          "ENERGY",
          "EMISSIONS",
          "FUEL",
          "RESOURCES",
          "WATER",
          "WASTE",
          "BIODIVERSITY",
          "AIR",
          "SCOPE3",
          "SOCIAL",
        ])
        .nullable()
        .describe("Filter to one domain, or null for all domains."),
      scope: z
        .enum(["scope1", "scope2", "scope3"])
        .nullable()
        .describe("Filter to one GHG scope, or null for all/none."),
    }),
    async execute(args) {
      try {
        let q = getClient()
          .from("output_parameter")
          .select("key,label,unit,scope,domain")
          .order("sort_order", { ascending: true })
          .limit(MAX_ROWS);
        if (args.domain) q = q.eq("domain", args.domain);
        if (args.scope) q = q.eq("scope", args.scope);
        const { data, error } = await q;
        if (error) throw error;
        note(
          `Listed ESG metrics${args.domain ? ` (${args.domain})` : ""}${
            args.scope ? ` [${args.scope}]` : ""
          }: ${data?.length ?? 0} found`
        );
        return JSON.stringify({ metrics: data ?? [] });
      } catch (err) {
        return `esg_list_metrics failed: ${errText(err)}`;
      }
    },
  });

  const listPlants = tool({
    name: "esg_list_plants",
    description:
      "List the plants/sites in the ESG database, including the GROUP rollup. Use the returned `code` values (e.g. 'GROUP', 'MATTAMPALLY') as the plantCode filter in esg_get_metric_values.",
    parameters: z.object({}),
    async execute() {
      try {
        const { data, error } = await getClient()
          .from("plant")
          .select("code,name,plant_type,is_group")
          .order("is_group", { ascending: false })
          .limit(MAX_ROWS);
        if (error) throw error;
        note(`Listed ESG plants: ${data?.length ?? 0}`);
        return JSON.stringify({ plants: data ?? [] });
      } catch (err) {
        return `esg_list_plants failed: ${errText(err)}`;
      }
    },
  });

  const listPeriods = tool({
    name: "esg_list_periods",
    description:
      "List the reporting periods available in the ESG database. Periods are Indian fiscal months (Apr–Mar), a year-to-date rollup ('ytd'), and 'baseline'. Use fiscalYear (e.g. '2024-25') and periodKind to filter metric values to the BRSR reporting year. For an annual BRSR figure, prefer periodKind 'ytd'.",
    parameters: z.object({
      fiscalYear: z
        .string()
        .nullable()
        .describe("Filter to one fiscal year like '2024-25', or null for all."),
    }),
    async execute(args) {
      try {
        let q = getClient()
          .from("period")
          .select("fiscal_year,period_kind,month_no,month_label")
          .order("fiscal_year", { ascending: false })
          .limit(MAX_ROWS);
        if (args.fiscalYear) q = q.eq("fiscal_year", args.fiscalYear);
        const { data, error } = await q;
        if (error) throw error;
        note(`Listed ESG periods${args.fiscalYear ? ` (${args.fiscalYear})` : ""}`);
        return JSON.stringify({ periods: data ?? [] });
      } catch (err) {
        return `esg_list_periods failed: ${errText(err)}`;
      }
    },
  });

  const getMetricValues = tool({
    name: "esg_get_metric_values",
    description:
      "Read computed values for one or more ESG metric keys (from esg_list_metrics), optionally filtered by plant code, fiscal year, and period kind. Returns rows of { metricKey, label, unit, plant, fiscalYear, periodKind, monthLabel, value }. For an annual company-wide BRSR number, query plantCode='GROUP' and periodKind='ytd'. Always cite the metric label + plant + period when you use a value.",
    parameters: z.object({
      metricKeys: z
        .array(z.string())
        .min(1)
        .max(25)
        .describe(
          "Output metric keys to fetch, e.g. ['emis.scope1_total','emis.scope2_total']."
        ),
      plantCode: z
        .string()
        .nullable()
        .describe("Plant code from esg_list_plants, or null for all plants."),
      fiscalYear: z
        .string()
        .nullable()
        .describe("Fiscal year like '2024-25', or null for all years."),
      periodKind: z
        .enum(["month", "ytd", "baseline"])
        .nullable()
        .describe(
          "Period granularity. Use 'ytd' for an annual figure; null for all."
        ),
    }),
    async execute(args) {
      try {
        const supabase = getClient();

        // Resolve the requested metric keys to their parameter ids + metadata.
        const { data: params, error: pErr } = await supabase
          .from("output_parameter")
          .select("id,key,label,unit")
          .in("key", args.metricKeys);
        if (pErr) throw pErr;
        if (!params || params.length === 0) {
          return JSON.stringify({
            rows: [],
            note: "No matching metric keys. Call esg_list_metrics to discover valid keys.",
          });
        }
        const byId = new Map(params.map((p) => [p.id as number, p]));

        // Build the value query, joining the plant + period dimensions so the
        // agent gets human-readable labels back (PostgREST embedded selects).
        let q = supabase
          .from("output_value")
          .select(
            "value_num,parameter_id,plant:plant_id(code),period:period_id(fiscal_year,period_kind,month_label)"
          )
          .in(
            "parameter_id",
            params.map((p) => p.id)
          )
          .limit(MAX_ROWS);

        if (args.plantCode) {
          q = q.eq("plant.code", args.plantCode).not("plant", "is", null);
        }
        if (args.fiscalYear) {
          q = q.eq("period.fiscal_year", args.fiscalYear).not("period", "is", null);
        }
        if (args.periodKind) {
          q = q.eq("period.period_kind", args.periodKind).not("period", "is", null);
        }

        const { data, error } = await q;
        if (error) throw error;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = (data ?? []).map((r: any) => {
          const p = byId.get(r.parameter_id);
          return {
            metricKey: p?.key,
            label: p?.label,
            unit: p?.unit,
            plant: r.plant?.code ?? null,
            fiscalYear: r.period?.fiscal_year ?? null,
            periodKind: r.period?.period_kind ?? null,
            monthLabel: r.period?.month_label ?? null,
            value: r.value_num,
          };
        });
        note(
          `Read ESG values for ${args.metricKeys.join(", ")}${
            args.plantCode ? ` @ ${args.plantCode}` : ""
          }${args.fiscalYear ? ` ${args.fiscalYear}` : ""}: ${rows.length} rows`
        );
        return JSON.stringify({ rows });
      } catch (err) {
        return `esg_get_metric_values failed: ${errText(err)}`;
      }
    },
  });

  return [listMetrics, listPlants, listPeriods, getMetricValues];
}
