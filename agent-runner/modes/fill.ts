// Fill mode handler — "Fill with AI" for the structured questionnaire.
//
// Unlike chat/write (Claude Agent SDK, MCP tools), fill runs on the OpenAI
// Agents SDK. The agent is given a self-describing field schema for one BRSR
// question and four ways to find grounded values: the company's uploaded PDFs
// (search_user_docs), the Supabase ESG database (esg_* tools), the AI-Context
// profile (folded into the prompt), and the web (hosted web search). It emits
// exactly one structured proposal per question, which the runner forwards as a
// `fill_proposal` NDJSON event for per-field review in the UI.

import { Agent, run, tool, webSearchTool } from "@openai/agents";
import { z } from "zod";
import { getVoyage } from "../lib/retrieval.ts";
import { searchUserDocs, type UserDocRef } from "../lib/rag/userIndex.ts";
import { createEsgTools, esgDbConfigured } from "../lib/agent/esgTool.ts";
import { resolveRagFramework } from "../lib/agent/frameworkMap.ts";
import type {
  EmitFn,
  FillJob,
  FillQuestionSpec,
  FillProposal,
} from "./types.ts";

const FILL_MODEL = process.env.OPENAI_FILL_MODEL || "gpt-5.5";

// ---------------------------------------------------------------------------
// Structured output schema (what the agent must return as its final answer).
// We keep `value` as a string|number|boolean|null union; the agent is told to
// coerce to the field's kind, and the route/UI re-validate against the real
// field before saving.
// ---------------------------------------------------------------------------

const proposedField = z.object({
  fieldId: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  confidence: z.number().min(0).max(1),
  source: z.string(),
  rationale: z.string().nullable(),
});

const fillOutputSchema = z.object({
  questionId: z.string(),
  fields: z.array(proposedField),
  rows: z.array(z.array(proposedField)).nullable(),
  unfilled: z
    .array(z.object({ fieldId: z.string(), reason: z.string() }))
    .nullable(),
});

// ---------------------------------------------------------------------------
// Prompt construction.
// ---------------------------------------------------------------------------

function describeField(f: FillQuestionSpec["fields"][number]): string {
  const bits: string[] = [`- ${f.id} — "${f.label}" (${f.kind}`];
  if (f.required) bits.push(", required");
  if (f.unit) bits.push(`, unit: ${f.unit}`);
  if (typeof f.min === "number") bits.push(`, min: ${f.min}`);
  if (typeof f.max === "number") bits.push(`, max: ${f.max}`);
  bits.push(")");
  let line = bits.join("");
  if (f.options?.length) {
    line += `\n    Allowed values (pick EXACTLY one verbatim): ${f.options
      .map((o) => `"${o}"`)
      .join(", ")}`;
  }
  if (f.help) line += `\n    Hint: ${f.help}`;
  return line;
}

function buildInstructions(job: FillJob): string {
  const ctx = job.aiContext;
  const ctxLines: string[] = [];
  if (ctx?.companyName) ctxLines.push(`Company: ${ctx.companyName}`);
  if (ctx?.websiteUrl) ctxLines.push(`Website: ${ctx.websiteUrl}`);
  if (ctx?.reportingYear) ctxLines.push(`Reporting year: ${ctx.reportingYear}`);
  if (ctx?.businessContext)
    ctxLines.push(`Business context: ${ctx.businessContext}`);
  const ctxBlock = ctxLines.length
    ? `\n\nAI Context (the org you are filling this report for):\n${ctxLines.join("\n")}`
    : "";

  const hasDocs = (job.userDocs?.length ?? 0) > 0;
  const hasEsg = job.useEsgDb && esgDbConfigured();

  const sources = [
    hasDocs
      ? "- search_user_docs(query): the company's own uploaded PDFs (policies, prior BRSR/annual reports, internal data). Your PRIMARY source for company-specific facts and figures."
      : "- (No uploaded documents are available for this run.)",
    hasEsg
      ? "- esg_list_metrics / esg_list_plants / esg_list_periods / esg_get_metric_values: the company's carbon-accounting database. Use it for QUANTITATIVE environmental fields (energy, water, waste, GHG Scope 1/2/3). For an annual company-wide figure, query plantCode='GROUP' and periodKind='ytd' for the reporting fiscal year."
      : "- (The ESG database is not available for this run.)",
    "- web_search(query): the public web. Use for verifiable public facts (CIN, listing/exchange details, registered address) when the documents don't have them. Prefer official/regulator sources.",
  ].join("\n");

  return `You are an expert preparer of the SEBI Business Responsibility & Sustainability Report (BRSR). Your job is to FILL IN the fields of ONE questionnaire question with accurate, grounded values that the user will review field-by-field before saving.

You are filling a regulatory disclosure. NEVER fabricate figures. Every value you propose must be traceable to one of your sources. If you cannot find a grounded value for a field, leave it out of "fields" and record it in "unfilled" with a brief reason — do NOT guess.

Sources available to you (call tools as needed; you may call several):
${sources}${ctxBlock}

How to fill:
1. Read the question and each field's schema (kind, unit, allowed values, bounds) below.
2. Gather facts: search the uploaded documents first for company specifics; use the ESG database for quantitative environmental metrics; use web search only for public registry-type facts the documents lack.
3. Produce a value for each field you can ground, coerced to the field's kind:
   - number: a JSON number (no units, no commas). Respect min/max.
   - select / selectCountry / selectGood / selectDependent: a string that is EXACTLY one of the allowed values shown.
   - boolean: true or false.
   - date: an ISO "YYYY-MM-DD" string.
   - text / longtext / email / tel: a string.
4. For each proposed field set: a confidence in [0,1]; a short 'source' string naming where it came from (e.g. "Acme BRSR 2023.pdf p.12", "ESG DB: Gross Scope 1 CO2, GROUP, FY2024-25", "web: BSE listing page"); and a one-sentence 'rationale' (or null).
5. Do not overwrite fields the user already filled (listed under "Already filled" below) unless they are clearly wrong; if you leave one as-is, simply omit it.

Return your answer as the structured output object (questionId + fields[, rows][, unfilled]). Set rows to null for non-table questions. Set unfilled to null if every field was filled.`;
}

function buildUserMessage(q: FillQuestionSpec): string {
  const lines: string[] = [
    `Question ${q.id} — "${q.label}"`,
    `Section: ${q.sectionTitle} (${q.sectionId})`,
  ];
  if (q.description) lines.push(`Description: ${q.description}`);
  lines.push("");
  if (q.questionKind === "table") {
    lines.push(
      `This is a TABLE question. Each row has the columns below. Propose one or more rows in the "rows" array (each row is an array of field objects keyed by the column id). Aim for at least ${
        q.minRows ?? 1
      } row(s) if you have data; leave rows empty only if you have none.`,
      "",
      "Columns:"
    );
  } else {
    lines.push("Fields to fill:");
  }
  lines.push(...q.fields.map(describeField));

  const existing = q.existingValues ?? {};
  const filledKeys = Object.keys(existing).filter(
    (k) => existing[k] !== null && existing[k] !== "" && existing[k] !== undefined
  );
  if (filledKeys.length) {
    lines.push("", "Already filled (leave these alone unless clearly wrong):");
    for (const k of filledKeys) {
      lines.push(`- ${k} = ${JSON.stringify(existing[k])}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tool: search_user_docs (OpenAI Agents SDK wrapper around the shared RAG core)
// ---------------------------------------------------------------------------

function makeUserDocsTool(
  userDocs: UserDocRef[],
  onHit: (summary: string) => void
) {
  return tool({
    name: "search_user_docs",
    description:
      "Search the company's own uploaded documents (policies, prior reports, internal data) and return the most relevant excerpts, each tagged with the document name and page range. Use this for company-specific facts and figures.",
    parameters: z.object({
      query: z
        .string()
        .min(2)
        .describe("Natural-language search query about the company's materials."),
      k: z
        .number()
        .int()
        .min(1)
        .max(10)
        .nullable()
        .describe("Number of excerpts to return. Defaults to 6."),
    }),
    async execute(args) {
      try {
        const hits = await searchUserDocs(args.query, userDocs, getVoyage(), {
          k: args.k ?? 6,
        });
        onHit(`Searched uploaded docs: "${args.query}" (${hits.length} hits)`);
        if (!hits.length) return "No matching excerpts found in the uploaded documents.";
        return hits
          .map((h, i) => {
            const pages =
              h.firstPage === h.lastPage
                ? `page ${h.firstPage}`
                : `pages ${h.firstPage}-${h.lastPage}`;
            return `<excerpt id="${i + 1}" document="${h.docName}" pages="${pages}">\n${h.text}\n</excerpt>`;
          })
          .join("\n\n");
      } catch (err) {
        return `search_user_docs failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Handler.
// ---------------------------------------------------------------------------

export async function handleFill(job: FillJob, emit: EmitFn): Promise<void> {
  if (!Array.isArray(job.questions) || job.questions.length === 0) {
    emit("error", { message: "questions is required (non-empty array)" });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    emit("error", { message: "OPENAI_API_KEY is not set in the sandbox env." });
    return;
  }

  const framework = resolveRagFramework(job.framework);
  const userDocs = job.userDocs ?? [];
  const useEsg = Boolean(job.useEsgDb) && esgDbConfigured();

  // Dedupe activity lines so repeated identical tool summaries don't spam.
  const seenActivity = new Set<string>();
  const activity = (summary: string) => {
    if (seenActivity.has(summary)) return;
    seenActivity.add(summary);
    emit("activity", { text: summary });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [webSearchTool()];
  if (userDocs.length) tools.push(makeUserDocsTool(userDocs, activity));
  if (useEsg) tools.push(...createEsgTools({ onQuery: activity }));

  const agent = new Agent({
    name: `${framework}-fill`,
    instructions: buildInstructions(job),
    model: FILL_MODEL,
    tools,
    outputType: fillOutputSchema,
  });

  const abortController = new AbortController();

  try {
    // Fill each requested question sequentially. (v1 ships single-question
    // fill from the UI, but the job shape supports a batch; sequential keeps
    // tool-call activity legible and bounds concurrent API usage.)
    for (const q of job.questions) {
      emit("activity", { text: `Filling ${q.id} — ${q.label}` });

      const stream = await run(agent, buildUserMessage(q), {
        stream: true,
        maxTurns: 16,
        signal: abortController.signal,
      });

      for await (const ev of stream) {
        if (ev.type === "run_item_stream_event") {
          if (ev.name === "tool_called") {
            // rawItem carries the tool name; surface a generic activity line in
            // case the tool's own onHit didn't fire (e.g. web search).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const name = (ev.item as any)?.rawItem?.name;
            if (name === "web_search" || name === "web_search_preview") {
              activity("Searching the web");
            }
          }
        }
      }

      await stream.completed;
      if (stream.error) {
        const e = stream.error;
        emit("error", {
          message: `Fill failed for ${q.id}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        });
        continue;
      }
      const out = stream.finalOutput as FillProposal | undefined;
      if (!out) {
        emit("error", {
          message: `The AI did not return a proposal for ${q.id}.`,
        });
        continue;
      }
      // Normalise the schema's nullable fields to the leaner public shape.
      const proposal: FillProposal = {
        questionId: out.questionId || q.id,
        fields: out.fields ?? [],
        rows: out.rows ?? undefined,
        unfilled: out.unfilled ?? undefined,
      };
      emit("fill_proposal", proposal);
    }

    emit("done", {});
  } catch (err) {
    emit("error", {
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    abortController.abort();
  }
}
