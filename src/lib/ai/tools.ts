// Tool definitions for the AI Dashboard chat. We expose a single tool
// (`render_chart`) — the model fills it out, the server validates against the
// catalogue, fetches the data, and renders.

import type OpenAI from "openai";

export const RENDER_CHART_TOOL: OpenAI.Responses.FunctionTool = {
  type: "function",
  name: "render_chart",
  description:
    "Render a chart from the available ESG reporting data. " +
    "Use this whenever the user asks to see, plot, chart, graph, visualise, " +
    "or compare metrics. Pick parameter codes, plant codes, and the period " +
    "code from the provided catalogue exactly — do not invent codes. If you " +
    "cannot find a suitable mapping, do NOT call this tool; respond in plain " +
    "text explaining why instead.",
  // `strict` is off because `options` is intentionally optional; OpenAI strict
  // mode would require every property to appear in `required`.
  strict: false,
  parameters: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["trend", "bar", "kpi", "stacked", "pie"],
        description:
          "kpi = a headline-number card. STRONGLY PREFER this when the user " +
          "asks 'what is', 'what's our', 'how much', or names a single metric " +
          "without asking to plot/chart/graph it (e.g. 'total scope 1', " +
          "'clinker factor', 'TSR'). KPIs also work for 2-4 single values " +
          "side-by-side.\n" +
          "trend = line over time (use with compare_by='time' when the user " +
          "asks 'through the year', 'monthly', 'over time', 'trend').\n" +
          "bar = vertical bars (use with compare_by='plant' to compare a " +
          "metric across plants, or for a one-off comparison of 2-6 metrics).\n" +
          "stacked = stacked bars (break a total into components across months " +
          "or plants).\n" +
          "pie = share of total (only for 2-6 mutually exclusive parts).",
      },
      title: {
        type: "string",
        description:
          "Short chart title (under 80 chars). Plain English, no markdown.",
      },
      period_code: {
        type: "string",
        description:
          "The reporting period code from the catalogue (e.g. '2024-25:ytd' " +
          "or '2024-25:month:3'). For compare_by='time' this selects the " +
          "fiscal year whose 12 months are plotted; for compare_by='plant' or " +
          "a kpi it selects the single period. Defaults to the current period " +
          "(flagged in the catalogue) when the user doesn't specify.",
      },
      plant_codes: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 7,
        description:
          "1-7 plant codes from the catalogue (e.g. 'GROUP', 'MATTAMPALLY'). " +
          "Use ['GROUP'] (the consolidated rollup) when the user doesn't name " +
          "specific plants. For compare_by='time' pass exactly one plant; for " +
          "compare_by='plant' pass the plants to compare.",
      },
      parameter_codes: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 8,
        description:
          "1-8 parameter codes from the catalogue. The renderer plots one " +
          "series per code (for compare_by='time') or per plant (for " +
          "compare_by='plant', in which case prefer a single parameter).",
      },
      granularity: {
        type: "string",
        enum: ["monthly", "annual"],
        description:
          "monthly: 12 points across the fiscal year (use for trend/stacked " +
          "with compare_by='time'). annual: a single value per series for the " +
          "chosen period (use for kpi/pie and for compare_by='plant').",
      },
      compare_by: {
        type: "string",
        enum: ["time", "plant"],
        description:
          "time = x-axis is months/periods for ONE plant (the first of " +
          "plant_codes). plant = x-axis is the plants in plant_codes for the " +
          "chosen period. Use 'time' for trends; use 'plant' to compare a " +
          "metric across sites. For a single-number kpi either works; prefer " +
          "'plant' with one plant.",
      },
      options: {
        type: "object",
        properties: {
          color: {
            type: "string",
            description:
              "Optional CSS colour for a single-series chart (e.g. '#074D47'). Ignored for multi-series.",
          },
        },
        additionalProperties: false,
      },
    },
    required: [
      "kind",
      "title",
      "period_code",
      "plant_codes",
      "parameter_codes",
      "granularity",
      "compare_by",
    ],
    additionalProperties: false,
  },
};
