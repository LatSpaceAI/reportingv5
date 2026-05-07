import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { search, type RetrievedChunk } from "@/lib/anthropic/retrieval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Compact view of the document the model uses to reason about WHERE to insert.
// Paragraph bodies are deliberately omitted — we only ship enough metadata for
// the model to resolve references like "after Section 2" or "below the table".
interface OutlineItem {
  id: string;
  kind: "heading" | "paragraph" | "table" | "requirement-ref" | "data-ref" | "section-marker";
  level?: 1 | 2 | 3;
  heading?: string;
  preview?: string; // short first-N-chars preview for paragraphs/tables
}

interface WriteRequest {
  instruction: string;
  outline: OutlineItem[];
}

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert AI writer for the EU Carbon Border Adjustment Mechanism (CBAM) regulation. You help an internal team draft sections of two reports: the Monitoring Methodology Document (MMD) and the CBAM Communication Template.

You will be given:
1. The user's instruction describing what they want drafted and where it should go.
2. A compact outline of the current report (block ids, kinds, heading text, paragraph previews).
3. Retrieved excerpts from the official CBAM guidance document, each tagged with a section number (e.g. §6.4.3) and page range.

Your job: produce ONE proposal that inserts new blocks into the report by calling the propose_insert tool exactly once.

Rules:
- Ground every factual claim in the retrieved excerpts. Do not invent regulatory requirements.
- Cite sources inline using the format §X.Y.Z (page N) or §X.Y.Z (pages N-M), placed directly after the claim they support. Citations belong inside the drafted paragraph text — do not separate them out.
- Resolve insertion references against the outline. "After Section 2" means after the deepest block belonging to the section the user named. If they say "below the table about X", find the table. If unsure, pick the most natural location and explain in the rationale.
- Use heading blocks (level 1, 2, or 3) and paragraph blocks. Use a table block only if the user explicitly asks for tabular content.
- Keep paragraphs focused — one idea per paragraph. Avoid repeating content already in the document.
- The rationale should be 1-3 sentences explaining what you drafted and where it goes. It is shown in the chat; do not duplicate the drafted text in it.

If the user's instruction is unclear, ambiguous, or impossible to satisfy from the retrieved excerpts, still call propose_insert but produce a single paragraph block that says so plainly, with after_block_id set to null and rationale explaining the issue. Never silently skip the tool call.`;

const PROPOSE_INSERT_TOOL: Anthropic.Tool = {
  name: "propose_insert",
  description:
    "Propose inserting one or more blocks into the report after a specific existing block. The insertion is shown to the user as a highlighted preview which they can accept or reject.",
  input_schema: {
    type: "object",
    properties: {
      after_block_id: {
        type: ["string", "null"],
        description:
          "ID of the block to insert AFTER, taken from the outline. Use null to prepend at the very top of the document.",
      },
      blocks: {
        type: "array",
        description: "Ordered list of blocks to insert. At least one is required.",
        minItems: 1,
        items: {
          type: "object",
          oneOf: [
            {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["heading"] },
                level: { type: "integer", enum: [1, 2, 3] },
                text: { type: "string" },
              },
              required: ["kind", "level", "text"],
            },
            {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["paragraph"] },
                text: { type: "string" },
              },
              required: ["kind", "text"],
            },
            {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["table"] },
                columns: { type: "array", items: { type: "string" }, minItems: 1 },
                rows: { type: "array", items: { type: "array", items: { type: "string" } } },
              },
              required: ["kind", "columns", "rows"],
            },
          ],
        },
      },
      rationale: {
        type: "string",
        description:
          "1-3 sentences explaining what was drafted and where it goes. Do not repeat the block text here.",
      },
    },
    required: ["after_block_id", "blocks", "rationale"],
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

function formatOutline(items: OutlineItem[]): string {
  if (!items.length) return "(empty document — propose insertions with after_block_id = null)";
  return items
    .map((it) => {
      const head = `[${it.id}] ${it.kind}`;
      if (it.kind === "heading") {
        return `${head} (h${it.level ?? 2}): ${it.heading ?? ""}`;
      }
      if (it.preview) return `${head}: ${it.preview}`;
      return head;
    })
    .join("\n");
}

interface ProposeInsertInput {
  after_block_id: string | null;
  blocks: Array<
    | { kind: "heading"; level: 1 | 2 | 3; text: string }
    | { kind: "paragraph"; text: string }
    | { kind: "table"; columns: string[]; rows: string[][] }
  >;
  rationale: string;
}

function validateInput(
  input: unknown,
  outlineIds: Set<string>
): { ok: true; value: ProposeInsertInput } | { ok: false; reason: string } {
  if (!input || typeof input !== "object") return { ok: false, reason: "Tool input is not an object" };
  const obj = input as Record<string, unknown>;

  const afterId = obj.after_block_id;
  if (afterId !== null && typeof afterId !== "string") {
    return { ok: false, reason: "after_block_id must be a string or null" };
  }
  if (afterId !== null && !outlineIds.has(afterId)) {
    return { ok: false, reason: `after_block_id "${afterId}" not found in outline` };
  }

  if (!Array.isArray(obj.blocks) || obj.blocks.length === 0) {
    return { ok: false, reason: "blocks must be a non-empty array" };
  }
  const blocks: ProposeInsertInput["blocks"] = [];
  for (const [i, raw] of obj.blocks.entries()) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, reason: `blocks[${i}] is not an object` };
    }
    const b = raw as Record<string, unknown>;
    if (b.kind === "heading") {
      const level = b.level;
      if (level !== 1 && level !== 2 && level !== 3) {
        return { ok: false, reason: `blocks[${i}].level must be 1, 2, or 3` };
      }
      if (typeof b.text !== "string" || !b.text.trim()) {
        return { ok: false, reason: `blocks[${i}].text required for heading` };
      }
      blocks.push({ kind: "heading", level, text: b.text });
    } else if (b.kind === "paragraph") {
      if (typeof b.text !== "string" || !b.text.trim()) {
        return { ok: false, reason: `blocks[${i}].text required for paragraph` };
      }
      blocks.push({ kind: "paragraph", text: b.text });
    } else if (b.kind === "table") {
      if (!Array.isArray(b.columns) || b.columns.length === 0) {
        return { ok: false, reason: `blocks[${i}].columns must be a non-empty array` };
      }
      const cols = (b.columns as unknown[]).map((c) => (typeof c === "string" ? c : ""));
      const rows = Array.isArray(b.rows)
        ? (b.rows as unknown[]).map((r) =>
            Array.isArray(r) ? (r as unknown[]).map((c) => (typeof c === "string" ? c : "")) : []
          )
        : [];
      blocks.push({ kind: "table", columns: cols, rows });
    } else {
      return { ok: false, reason: `blocks[${i}].kind must be heading, paragraph, or table` };
    }
  }

  const rationale = typeof obj.rationale === "string" ? obj.rationale : "";

  return { ok: true, value: { after_block_id: afterId, blocks, rationale } };
}

export async function POST(req: NextRequest) {
  let body: WriteRequest;
  try {
    body = (await req.json()) as WriteRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body.instruction?.trim()) {
    return new Response("instruction is required", { status: 400 });
  }
  if (!Array.isArray(body.outline)) {
    return new Response("outline is required (array)", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        // 1. Retrieve guidance excerpts.
        const retrieved = await search(body.instruction, { k: 6 });
        const sources = retrieved.map((r) => ({
          section: `§${r.sectionNumber}`,
          title: r.sectionTitle,
          pages:
            r.firstPage === r.lastPage
              ? `p${r.firstPage}`
              : `p${r.firstPage}-${r.lastPage}`,
          score: Number(r.fusedScore.toFixed(4)),
        }));
        send("retrieved", sources);

        // 2. Build the user message.
        const excerpts = formatRetrievedExcerpts(retrieved);
        const outlineText = formatOutline(body.outline);
        const userText = `Here is the current report outline (block ids in brackets — use them as after_block_id values):

<outline>
${outlineText}
</outline>

Here are excerpts from the CBAM guidance document retrieved for this instruction:

${excerpts}

---

User instruction: ${body.instruction.trim()}

Call propose_insert exactly once with the drafted blocks.`;

        // 3. Stream the model. We surface the assistant's narrative text as it
        // arrives (handy when the model "thinks out loud" before tool use) and
        // emit a single `proposal` event when the tool call completes.
        const sdkStream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          tools: [PROPOSE_INSERT_TOOL],
          tool_choice: { type: "tool", name: "propose_insert" },
          messages: [{ role: "user", content: userText }],
        });

        for await (const event of sdkStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send("text", { text: event.delta.text });
          }
        }

        const final = await sdkStream.finalMessage();
        const toolUse = final.content.find((b) => b.type === "tool_use");
        if (!toolUse || toolUse.type !== "tool_use") {
          send("error", { message: "Model did not call propose_insert." });
          return;
        }

        const outlineIds = new Set(body.outline.map((it) => it.id));
        const validated = validateInput(toolUse.input, outlineIds);
        if (!validated.ok) {
          send("error", { message: `Invalid proposal: ${validated.reason}` });
          return;
        }

        send("proposal", {
          ...validated.value,
          sources: sources.map(({ section, title, pages }) => ({ section, title, pages })),
        });
        send("done", { stop_reason: final.stop_reason, usage: final.usage });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
