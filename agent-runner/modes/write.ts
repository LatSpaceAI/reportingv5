// Write mode handler. Mirrors the body of the previous Next route at
// src/app/api/write/route.ts (pre-dispatcher refactor) one-for-one — same
// agent options, same MCP server, same event types — except instead of
// pushing to a ReadableStream we call emit() which writes one NDJSON line
// per event to stdout.

import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { getSystemPrompt } from "../lib/guidance.ts";
import {
  createAgentMcpServer,
  toolProposeInsert,
  toolSearchGuidance,
  type ProposalBlocks,
  type RetrievedSource,
} from "../lib/agent/tools.ts";
import { resolveRagFramework } from "../lib/agent/frameworkMap.ts";
import { describeToolUse } from "../lib/agent/activity.ts";
import type { OutlineItem, WriteJob, EmitFn } from "./types.ts";

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

  const framework = resolveRagFramework(job.framework);
  const outlineText = formatOutline(job.outline);
  const userText = `Here is the current report outline (block ids in brackets — use them as after_block_id values):

<outline>
${outlineText}
</outline>

---

User instruction: ${job.instruction.trim()}

Search the guidance for any regulatory facts you need, then call propose_insert exactly once with the drafted blocks.`;

  async function* once(): AsyncIterable<SDKUserMessage> {
    yield {
      type: "user",
      message: { role: "user", content: userText } as MessageParam,
      parent_tool_use_id: null,
    };
  }

  const abortController = new AbortController();
  const outlineIds = new Set(job.outline.map((it) => it.id));
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

  const mcpServer = createAgentMcpServer(framework, {
    onSearchHit,
    outlineIds,
    onProposal,
  });

  const q = query({
    prompt: once(),
    options: {
      model: "claude-opus-4-7",
      systemPrompt: getSystemPrompt(framework, "write"),
      mcpServers: { [framework]: mcpServer },
      allowedTools: [
        toolSearchGuidance(framework),
        toolProposeInsert(framework),
        "WebSearch",
        "WebFetch",
      ],
      tools: ["WebSearch", "WebFetch"],
      settingSources: [],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      persistSession: false,
      includePartialMessages: false,
      // 16 turns. Write tasks sometimes do "search, refine, search
      // again, cross-reference with a web source, then propose, then
      // revise after a tool error" — that's already 6+ turns. Headroom
      // matters here because a truncated proposal is worse than a
      // chatty one. Drop to 4 on Hobby — see DEPLOY.md plan tuning.
      maxTurns: 16,
      abortController,
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: `${framework}-app/1.0` },
    },
  });

  const seenBlockText = new Map<string, number>();
  const seenToolUseIds = new Set<string>();
  const toolErrorMessages: string[] = [];

  try {
    for await (const msg of q) {
      if (msg.type === "assistant") {
        const blocks = msg.message.content ?? [];
        const acc: string[] = [];
        for (const b of blocks) {
          if (b.type === "text") {
            acc.push(b.text);
          } else if (b.type === "tool_use") {
            if (!seenToolUseIds.has(b.id)) {
              seenToolUseIds.add(b.id);
              emit("activity", describeToolUse(b.name, b.input, framework));
            }
          }
        }
        const fullText = acc.join("");
        const prev = seenBlockText.get(msg.uuid) ?? 0;
        if (fullText.length > prev) {
          const delta = fullText.slice(prev);
          seenBlockText.set(msg.uuid, fullText.length);
          if (delta) emit("text", { text: delta });
        }
      } else if (msg.type === "user" && msg.tool_use_result !== undefined) {
        const r = msg.tool_use_result as
          | { isError?: boolean; content?: Array<{ text?: string }> }
          | undefined;
        if (r?.isError) {
          toolErrorMessages.push(r.content?.[0]?.text ?? "tool error");
        }
      } else if (msg.type === "result") {
        if (msg.subtype !== "success") {
          const errs = [...(msg.errors ?? []), ...toolErrorMessages];
          emit("error", { message: errs.join(" | ") || msg.subtype });
          return;
        }
        if (!proposal) {
          emit("error", { message: "Model did not call propose_insert." });
          return;
        }
        emit("proposal", {
          after_block_id: (proposal as ProposalBlocks).after_block_id,
          blocks: (proposal as ProposalBlocks).blocks,
          rationale: (proposal as ProposalBlocks).rationale,
          sources: allSources.map(({ section, title, pages }) => ({ section, title, pages })),
        });
        emit("done", {
          stop_reason: msg.stop_reason,
          usage: msg.usage,
          cost_usd: msg.total_cost_usd,
        });
      }
    }
  } finally {
    abortController.abort();
  }
}
