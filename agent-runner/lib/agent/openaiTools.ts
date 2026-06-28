// Shared OpenAI Agents SDK tools for the chat and write modes (the fill mode
// builds its own toolset in modes/fill.ts). These replace the in-process MCP
// tools in tools.ts (Claude Agent SDK) one-for-one: search_guidance over the
// prebuilt framework RAG index, and search_user_docs over the user's uploaded
// PDFs. Both forward their hits to a callback so the runner can stream
// `retrieved` events to the client UI unchanged.

import { tool } from "@openai/agents";
import { z } from "zod";
import { search, getVoyage, type Framework, type RetrievedChunk } from "../retrieval.ts";
import { searchUserDocs, type UserDocRef, type UserDocHit } from "../rag/userIndex.ts";

export interface RetrievedSource {
  section: string;
  title: string;
  pages: string;
  score: number;
}

const FRAMEWORK_INFO: Record<Framework, { docName: string; sectionExample: string }> = {
  cdp: {
    docName: "the official CDP 2026 questionnaire guidance document",
    sectionExample: "§C2.2a",
  },
  brsr: {
    docName: "the SEBI BRSR guidance note (Annexure II)",
    sectionExample: "§C.P3.E.Q5",
  },
};

function pageRange(first: number, last: number): string {
  return first === last ? `page ${first}` : `pages ${first}-${last}`;
}

function chunkToSource(c: RetrievedChunk): RetrievedSource {
  return {
    section: `§${c.sectionNumber}`,
    title: c.sectionTitle,
    pages: c.firstPage === c.lastPage ? `p${c.firstPage}` : `p${c.firstPage}-${c.lastPage}`,
    score: Number(c.fusedScore.toFixed(4)),
  };
}

function userHitToSource(h: UserDocHit): RetrievedSource {
  return {
    section: h.docName,
    title: "(uploaded)",
    pages: h.firstPage === h.lastPage ? `p${h.firstPage}` : `p${h.firstPage}-${h.lastPage}`,
    score: Number(h.fusedScore.toFixed(4)),
  };
}

function formatGuidanceExcerpts(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const path = c.sectionPath.join(" › ");
      return `<excerpt id="${i + 1}" section="§${c.sectionNumber}" pages="${pageRange(
        c.firstPage,
        c.lastPage
      )}">\nSection path: ${path}\n\n${c.text}\n</excerpt>`;
    })
    .join("\n\n");
}

function formatUserExcerpts(hits: UserDocHit[]): string {
  return hits
    .map(
      (h, i) =>
        `<excerpt id="${i + 1}" document="${h.docName}" pages="${pageRange(
          h.firstPage,
          h.lastPage
        )}">\n${h.text}\n</excerpt>`
    )
    .join("\n\n");
}

export interface SharedToolHooks {
  /** Called with surfaced guidance/user-doc sources so the runner can emit a
   *  `retrieved` NDJSON event. */
  onSearchHit?: (sources: RetrievedSource[]) => void;
}

// --- write mode: propose_insert -------------------------------------------

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

/** Build the propose_insert tool. The agent calls it exactly once to emit the
 *  drafted blocks; the proposal is forwarded via onProposal and after_block_id
 *  is validated against the outline ids. */
export function makeProposeInsertTool(
  framework: Framework,
  outlineIds: Set<string>,
  onProposal: (p: ProposalBlocks) => void
) {
  const info = FRAMEWORK_INFO[framework];

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
      .nullable()
      .describe(
        `Optional caption shown beneath the diagram. Good place to put a citation like 'Source: ${info.sectionExample} (page N)'.`
      ),
  });

  return tool({
    name: "propose_insert",
    description:
      "Insert one or more blocks into the user's report at a specific location. Call this exactly once per writing task, after you have searched the guidance for any factual claims you intend to make. The insertion appears to the user as a highlighted preview that they can accept or reject — do not call this for ordinary chat answers.",
    parameters: z.object({
      after_block_id: z
        .string()
        .nullable()
        .describe(
          "ID of the existing block to insert AFTER, taken verbatim from the outline provided in the user message. Use null to prepend at the very top of the document."
        ),
      blocks: z
        .array(z.union([headingBlock, paragraphBlock, tableBlock, diagramBlock]))
        .min(1)
        .describe(
          "Ordered list of blocks to insert. Use heading + paragraph for new sections; use table only if the user explicitly asked for tabular content; use diagram when the user asks for a flow/system-boundary/process visualization or when a diagram clearly aids comprehension."
        ),
      rationale: z
        .string()
        .min(1)
        .describe(
          "1-3 sentences explaining what was drafted and where it goes. Do not duplicate the block text here."
        ),
    }),
    async execute(args) {
      if (args.after_block_id !== null && !outlineIds.has(args.after_block_id)) {
        return `after_block_id "${args.after_block_id}" is not in the outline. Pick one of the IDs in square brackets, or use null to prepend.`;
      }
      // Normalise diagram captions (Zod gives null; downstream wants optional).
      const blocks = args.blocks.map((b) =>
        b.kind === "diagram"
          ? { ...b, caption: b.caption ?? undefined }
          : b
      ) as ProposalBlocks["blocks"];
      onProposal({
        after_block_id: args.after_block_id,
        blocks,
        rationale: args.rationale,
      });
      return "Proposal accepted into the editor. The user will review it.";
    },
  });
}

/** Build the search_guidance tool for a framework. */
export function makeSearchGuidanceTool(framework: Framework, hooks: SharedToolHooks) {
  const info = FRAMEWORK_INFO[framework];
  return tool({
    name: "search_guidance",
    description: `Search ${info.docName} and return the most relevant excerpts. Each excerpt is tagged with a section number (e.g. ${info.sectionExample}) and page range that you must cite verbatim in your reply. Call this whenever the user asks a substantive regulatory question. You may call it multiple times with different queries to cover compound questions.`,
    parameters: z.object({
      query: z
        .string()
        .min(2)
        .describe(
          "Natural-language search query. Be specific — e.g., 'system boundaries for embedded emissions' beats 'emissions'."
        ),
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
        const chunks = await search(args.query, framework, { k: args.k ?? 6 });
        hooks.onSearchHit?.(chunks.map(chunkToSource));
        return chunks.length
          ? formatGuidanceExcerpts(chunks)
          : "No matching excerpts found in the guidance document for this query.";
      } catch (err) {
        return `search_guidance failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}

/** Build the search_user_docs tool. Caller should only add it when userDocs is
 *  non-empty (so the model isn't offered a tool that can't return anything). */
export function makeSearchUserDocsTool(
  framework: Framework,
  userDocs: UserDocRef[],
  hooks: SharedToolHooks
) {
  const info = FRAMEWORK_INFO[framework];
  return tool({
    name: "search_user_docs",
    description: `Search the company's OWN uploaded documents (policies, prior reports, internal data, supplier documents) and return the most relevant excerpts. Each excerpt is tagged with the document name and page range that you must cite in your reply (e.g. "(Acme Sustainability Policy.pdf, page 4)"). Use this for company-specific facts about how THIS organization operates — distinct from ${info.docName}, which covers the regulatory requirements. Combine both when useful.`,
    parameters: z.object({
      query: z
        .string()
        .min(2)
        .describe("Natural-language search query about the company's own materials."),
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
        hooks.onSearchHit?.(hits.map(userHitToSource));
        return hits.length
          ? formatUserExcerpts(hits)
          : "No matching excerpts found in the uploaded documents for this query.";
      } catch (err) {
        return `search_user_docs failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
