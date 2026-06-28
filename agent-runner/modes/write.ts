// Write mode handler (OpenAI Agents SDK).
//
// Ported from the original Claude Agent SDK implementation. The event contract
// to the client is unchanged — `retrieved`, `text`, `activity`, `proposal`,
// `done`, `error` — so the document editor / AssistantPane need no changes.
// The agent searches the guidance (and optionally the user's docs / the web),
// then calls propose_insert exactly once with the drafted blocks.

import { Agent, run, webSearchTool, user } from "@openai/agents";
import { getSystemPrompt } from "../lib/guidance.ts";
import {
  makeSearchGuidanceTool,
  makeSearchUserDocsTool,
  makeProposeInsertTool,
  type RetrievedSource,
  type ProposalBlocks,
} from "../lib/agent/openaiTools.ts";
import { resolveRagFramework } from "../lib/agent/frameworkMap.ts";
import { describeToolUse } from "../lib/agent/activity.ts";
import type { OutlineItem, WriteJob, EmitFn } from "./types.ts";

const WRITE_MODEL = process.env.OPENAI_WRITE_MODEL || "gpt-5";

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

export async function handleWrite(job: WriteJob, emit: EmitFn): Promise<void> {
  if (!job.instruction?.trim()) {
    emit("error", { message: "instruction is required" });
    return;
  }
  if (!Array.isArray(job.outline)) {
    emit("error", { message: "outline is required (array)" });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    emit("error", { message: "OPENAI_API_KEY is not set in the sandbox env." });
    return;
  }

  const framework = resolveRagFramework(job.framework);
  const userDocs = job.userDocs ?? [];
  const outlineIds = new Set(job.outline.map((it) => it.id));
  const abortController = new AbortController();

  const allSources: RetrievedSource[] = [];
  const seen = new Set<string>();
  const onSearchHit = (sources: RetrievedSource[]) => {
    const fresh = sources.filter((s) => {
      const key = `${s.section}|${s.pages}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length) {
      allSources.push(...fresh);
      emit("retrieved", fresh);
    }
  };

  let proposal: ProposalBlocks | null = null;
  const onProposal = (p: ProposalBlocks) => {
    proposal = p;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [
    makeSearchGuidanceTool(framework, { onSearchHit }),
    makeProposeInsertTool(framework, outlineIds, onProposal),
    webSearchTool(),
  ];
  if (userDocs.length) {
    tools.push(makeSearchUserDocsTool(framework, userDocs, { onSearchHit }));
  }

  const agent = new Agent({
    name: `${framework}-write`,
    instructions: getSystemPrompt(framework, "write"),
    model: WRITE_MODEL,
    tools,
  });

  const outlineText = formatOutline(job.outline);
  const userText = `Here is the current report outline (block ids in brackets — use them as after_block_id values):

<outline>
${outlineText}
</outline>

---

User instruction: ${job.instruction.trim()}

Search the guidance for any regulatory facts you need, then call propose_insert exactly once with the drafted blocks.`;

  const seenToolCalls = new Set<string>();

  try {
    const stream = await run(agent, [user(userText)], {
      stream: true,
      maxTurns: 16,
      signal: abortController.signal,
    });

    for await (const ev of stream) {
      if (ev.type === "raw_model_stream_event") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = ev.data as any;
        if (data?.type === "output_text_delta" && typeof data.delta === "string") {
          if (data.delta) emit("text", { text: data.delta });
        }
      } else if (ev.type === "run_item_stream_event" && ev.name === "tool_called") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = (ev.item as any)?.rawItem;
        const name: string | undefined = raw?.name;
        const callId: string = raw?.callId ?? raw?.id ?? `${name}-${seenToolCalls.size}`;
        if (name && !seenToolCalls.has(callId)) {
          seenToolCalls.add(callId);
          let input: unknown = raw?.arguments;
          if (typeof input === "string") {
            try {
              input = JSON.parse(input);
            } catch {
              /* leave as string */
            }
          }
          emit("activity", describeToolUse(name, input, framework));
        }
      }
    }

    await stream.completed;
    if (stream.error) {
      const e = stream.error;
      emit("error", { message: e instanceof Error ? e.message : String(e) });
      return;
    }
    if (!proposal) {
      emit("error", { message: "Model did not call propose_insert." });
      return;
    }
    const p = proposal as ProposalBlocks;
    emit("proposal", {
      after_block_id: p.after_block_id,
      blocks: p.blocks,
      rationale: p.rationale,
      sources: allSources.map(({ section, title, pages }) => ({ section, title, pages })),
    });
    emit("done", {});
  } catch (err) {
    emit("error", { message: err instanceof Error ? err.message : String(err) });
  } finally {
    abortController.abort();
  }
}
