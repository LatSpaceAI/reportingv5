// POST /api/esg/dashboard/chat
//
// In-process AI Dashboard endpoint. Accepts the full message history (the client
// owns thread state), runs OpenAI with the `render_chart` tool, validates and
// hydrates any tool call against plato's ESG database, and streams back
// newline-delimited JSON events:
//
//   { "type": "text",  "text": "..." }                  incremental assistant text
//   { "type": "chart", "spec": {...}, "data": {...} }    on a successful render
//   { "type": "error", "message": "..." }                recoverable, user-facing
//   { "type": "done" }                                   final event
//
// Unlike plato's /api/chat (which dispatches a Claude agent into a Vercel
// Sandbox), this runs entirely on the Next.js server because the sandbox cannot
// reach Supabase — the data fetch must happen here.

import type OpenAI from "openai";

import { getOpenAIClient, DASHBOARD_MODEL } from "@/lib/ai/openai";
import { RENDER_CHART_TOOL } from "@/lib/ai/tools";
import { loadCatalogue, catalogueToPrompt } from "@/lib/dashboard/catalogue";
import { ChartSpecSchema } from "@/lib/dashboard/chart-spec";
import { validateSpec } from "@/lib/dashboard/validate-spec";
import { fetchChartData } from "@/lib/dashboard/fetch-chart-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

const SYSTEM_BASE = [
  "You are the chart-generation assistant for the LatSpace ESG reporting dashboard.",
  "The underlying data is a multi-plant cement-company carbon-accounting model: metrics are reported per plant (site), per reporting period, with monthly granularity over an Indian fiscal year (April–March).",
  "Your job: turn the user's natural-language request into one chart by calling the `render_chart` tool, using ONLY codes from the catalogue below.",
  "",
  "Rules:",
  "- Always prefer `render_chart` when the user wants to see, plot, compare, or visualise data.",
  "- Use the catalogue exactly. Never invent a parameter, plant, or period code; never guess at codes that are not listed.",
  "- If the request doesn't map to any catalogued parameter, reply in plain text explaining what's missing, and suggest the 1-3 closest available parameters by display name.",
  "- Plants: when the user doesn't name specific plants, use ['GROUP'] (the consolidated rollup). When they name plants, use those codes.",
  "- Periods: default to the period flagged (current) when none is named.",
  "- compare_by:",
  "    * 'time'  → x-axis is months of a fiscal year for ONE plant. Use for trends ('through the year', 'monthly', 'over time'). Pass exactly one plant and granularity='monthly'.",
  "    * 'plant' → x-axis is the plants you list, for one period. Use to compare a metric across sites ('compare X across plants', 'which plant…'). Use granularity='annual'.",
  "- Choose `kind`:",
  "    * kpi = a headline number card. PREFER this for 'what is X', 'how much X', 'show me X' for a single metric (e.g. 'total scope 1', 'clinker factor', 'TSR'). Also good for 2-4 single-number comparisons.",
  "    * trend = line over time (compare_by='time').",
  "    * bar = compare a few metrics, or one metric across plants (compare_by='plant').",
  "    * stacked = break a total into parts across months or plants.",
  "    * pie = share of a total — only for 2-6 mutually exclusive parts.",
  "- A request like 'what's our scope 1' is a KPI. 'show scope 1 through the year' is a trend. 'compare scope 1 across plants' is a bar with compare_by='plant'.",
  "- Keep titles short and human ('Scope 1 emissions, YTD'), not verbose.",
  "- One chart per response. If the user wants two charts, ask which one to do first.",
].join("\n");

function ndjsonEncoder() {
  const encoder = new TextEncoder();
  return (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages[] required" }), {
      status: 400,
    });
  }

  let catalogue;
  try {
    catalogue = await loadCatalogue();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Catalogue unavailable: ${(err as Error).message}` }),
      { status: 500 }
    );
  }
  const cataloguePrompt = catalogueToPrompt(catalogue);

  // Static instructions + the heavy catalogue text. OpenAI caches stable prompt
  // prefixes automatically, so no explicit cache-control directives are needed.
  const instructions = `${SYSTEM_BASE}\n\n${cataloguePrompt}`;

  const input: OpenAI.Responses.ResponseInput = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const enc = ndjsonEncoder();
  const client = getOpenAIClient();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc(obj));
      try {
        const result = client.responses.stream({
          model: DASHBOARD_MODEL,
          max_output_tokens: 1024,
          instructions,
          tools: [RENDER_CHART_TOOL],
          tool_choice: "auto",
          input,
        });

        for await (const event of result) {
          if (event.type === "response.output_text.delta" && event.delta) {
            send({ type: "text", text: event.delta });
          }
        }

        const final = await result.finalResponse();

        const toolCall = final.output.find(
          (item) => item.type === "function_call" && item.name === "render_chart"
        ) as OpenAI.Responses.ResponseFunctionToolCall | undefined;

        if (toolCall) {
          let toolInput: unknown;
          try {
            toolInput = JSON.parse(toolCall.arguments);
          } catch {
            toolInput = null;
          }
          const parsed = ChartSpecSchema.safeParse(toolInput);
          if (!parsed.success) {
            send({
              type: "error",
              message:
                "I tried to build a chart but the spec was malformed. Could you rephrase?",
            });
          } else {
            const verdict = validateSpec(parsed.data, catalogue);
            if (!verdict.ok) {
              send({ type: "error", message: verdict.reason });
            } else {
              try {
                const data = await fetchChartData(parsed.data, catalogue);
                send({ type: "chart", spec: parsed.data, data });
              } catch (err) {
                send({
                  type: "error",
                  message: `Couldn't load chart data: ${(err as Error).message}`,
                });
              }
            }
          }
        }

        send({ type: "done" });
        controller.close();
      } catch (err) {
        try {
          send({ type: "error", message: (err as Error).message ?? "Unknown error" });
          send({ type: "done" });
        } catch {
          /* controller may already be closed */
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
