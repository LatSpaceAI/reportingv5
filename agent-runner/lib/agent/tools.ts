// In-process MCP tools exposed to the Claude Agent SDK. Each request builds
// its own server via createAgentMcpServer() so the tool handlers can close
// over per-request callbacks (forwarding retrieved sources / proposals to
// the runner's NDJSON stream) and the active framework's RAG index.
//
// Tool names registered here are surfaced to the agent as
// `mcp__<framework>__<tool_name>`; the runner adds those to allowedTools.

import { tool, createSdkMcpServer, type SdkMcpToolDefinition } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { search, type Framework, type RetrievedChunk } from "../retrieval.ts";

export interface RetrievedSource {
  section: string;
  title: string;
  pages: string;
  score: number;
}

export interface ProposalBlocks {
  after_block_id: string | null;
  blocks: Array<
    | { kind: "heading"; level: 1 | 2 | 3; text: string }
    | { kind: "paragraph"; text: string }
    | { kind: "table"; columns: string[]; rows: string[][] }
    | { kind: "diagram"; format: "mermaid"; source: string; caption?: string }
  >;
  rationale: string;
}

interface AgentMcpOptions {
  // Called once per `search_guidance` invocation with the surfaced sources, so
  // the runner can stream them to the client as a `retrieved` NDJSON event.
  onSearchHit?: (sources: RetrievedSource[]) => void;
  // Write mode only. When provided, the propose_insert tool is registered.
  // Outline IDs are validated against this set; the proposal is forwarded via
  // onProposal for the runner to emit as a `proposal` NDJSON event.
  outlineIds?: Set<string>;
  onProposal?: (proposal: ProposalBlocks) => void;
}

// Per-framework descriptors used to build the `search_guidance` tool's
// description. Knowing what the agent is actually retrieving from helps the
// model decide when to call the tool and what to query for.
const FRAMEWORK_INFO: Record<Framework, { docName: string; sectionExample: string }> = {
  cbam: {
    docName: "the official EU CBAM guidance document",
    sectionExample: "§6.4.3",
  },
  cdp: {
    docName: "the official CDP 2026 questionnaire guidance document",
    sectionExample: "§C2.2a",
  },
  brsr: {
    docName: "the SEBI BRSR guidance note (Annexure II)",
    sectionExample: "§C.P3.E.Q5",
  },
};

function formatRetrievedExcerpts(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const pages =
        c.firstPage === c.lastPage ? `page ${c.firstPage}` : `pages ${c.firstPage}-${c.lastPage}`;
      const path = c.sectionPath.join(" › ");
      return `<excerpt id="${i + 1}" section="§${c.sectionNumber}" pages="${pages}">
Section path: ${path}

${c.text}
</excerpt>`;
    })
    .join("\n\n");
}

function chunkToSource(c: RetrievedChunk): RetrievedSource {
  return {
    section: `§${c.sectionNumber}`,
    title: c.sectionTitle,
    pages: c.firstPage === c.lastPage ? `p${c.firstPage}` : `p${c.firstPage}-${c.lastPage}`,
    score: Number(c.fusedScore.toFixed(4)),
  };
}

export function createAgentMcpServer(framework: Framework, opts: AgentMcpOptions) {
  const info = FRAMEWORK_INFO[framework];

  const searchGuidance = tool(
    "search_guidance",
    `Search ${info.docName} and return the most relevant excerpts. Each excerpt is tagged with a section number (e.g. ${info.sectionExample}) and page range that you must cite verbatim in your reply. Call this whenever the user asks a substantive regulatory question. You may call it multiple times with different queries to cover compound questions.`,
    {
      query: z
        .string()
        .min(2)
        .describe("Natural-language search query. Be specific — e.g., 'system boundaries for embedded emissions' beats 'emissions'."),
      k: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Number of excerpts to return. Defaults to 6."),
    },
    async (args) => {
      try {
        const k = args.k ?? 6;
        const chunks = await search(args.query, framework, { k });
        const sources = chunks.map(chunkToSource);
        opts.onSearchHit?.(sources);
        const text = chunks.length
          ? formatRetrievedExcerpts(chunks)
          : "No matching excerpts found in the guidance document for this query.";
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return {
          content: [{ type: "text" as const, text: `search_guidance failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // Use `any` schema so tools with different Zod input shapes can coexist in
  // one array — this matches CreateSdkMcpServerOptions['tools'] in the SDK.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: SdkMcpToolDefinition<any>[] = [searchGuidance];

  if (opts.outlineIds && opts.onProposal) {
    const outlineIds = opts.outlineIds;
    const onProposal = opts.onProposal;

    const headingBlock = z.object({
      kind: z.literal("heading"),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      text: z.string().min(1),
    });
    const paragraphBlock = z.object({
      kind: z.literal("paragraph"),
      text: z.string().min(1),
    });
    const tableBlock = z.object({
      kind: z.literal("table"),
      columns: z.array(z.string()).min(1),
      rows: z.array(z.array(z.string())),
    });
    const diagramBlock = z.object({
      kind: z.literal("diagram"),
      format: z.literal("mermaid"),
      source: z
        .string()
        .min(1)
        .describe(
          "Mermaid source. Prefer flowchart TD or LR for system boundaries / process flows; sequenceDiagram for monitoring/data exchange flows. Keep node labels short."
        ),
      caption: z
        .string()
        .optional()
        .describe(
          `Optional caption shown beneath the diagram. Good place to put a citation like 'Source: ${info.sectionExample} (page N)'.`
        ),
    });

    const proposeInsert = tool(
      "propose_insert",
      "Insert one or more blocks into the user's report at a specific location. Call this exactly once per writing task, after you have searched the guidance for any factual claims you intend to make. The insertion appears to the user as a highlighted preview that they can accept or reject — do not call this for ordinary chat answers.",
      {
        after_block_id: z
          .string()
          .nullable()
          .describe(
            "ID of the existing block to insert AFTER, taken verbatim from the outline provided in the user message. Use null to prepend at the very top of the document."
          ),
        blocks: z
          .array(z.union([headingBlock, paragraphBlock, tableBlock, diagramBlock]))
          .min(1)
          .describe("Ordered list of blocks to insert. Use heading + paragraph for new sections; use table only if the user explicitly asked for tabular content; use diagram when the user asks for a flow/system-boundary/process visualization or when a diagram clearly aids comprehension."),
        rationale: z
          .string()
          .min(1)
          .describe("1-3 sentences explaining what was drafted and where it goes. Do not duplicate the block text here."),
      },
      async (args) => {
        if (args.after_block_id !== null && !outlineIds.has(args.after_block_id)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `after_block_id "${args.after_block_id}" is not in the outline. Pick one of the IDs in square brackets, or use null to prepend.`,
              },
            ],
            isError: true,
          };
        }
        onProposal({
          after_block_id: args.after_block_id,
          blocks: args.blocks,
          rationale: args.rationale,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: "Proposal accepted into the editor. The user will review it.",
            },
          ],
        };
      }
    );

    tools.push(proposeInsert);
  }

  return createSdkMcpServer({
    name: framework,
    version: "1.0.0",
    tools,
  });
}

// Tool name strings for the runner's allowedTools list. Framework-scoped
// because the SDK prefixes tool names with the MCP server name.
export function toolSearchGuidance(framework: Framework): string {
  return `mcp__${framework}__search_guidance`;
}
export function toolProposeInsert(framework: Framework): string {
  return `mcp__${framework}__propose_insert`;
}
