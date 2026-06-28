// Chat mode handler (OpenAI Agents SDK).
//
// Ported from the original Claude Agent SDK implementation. The event contract
// to the client is unchanged — `retrieved`, `text`, `activity`, `done`,
// `error` — so AssistantPane needs no changes. Tools (search_guidance,
// search_user_docs, web search) are the OpenAI-SDK equivalents of the former
// in-process MCP tools.

import { Agent, run, webSearchTool, user, assistant, type AgentInputItem } from "@openai/agents";
import { getSystemPrompt } from "../lib/guidance.ts";
import {
  makeSearchGuidanceTool,
  makeSearchUserDocsTool,
  type RetrievedSource,
} from "../lib/agent/openaiTools.ts";
import { resolveRagFramework } from "../lib/agent/frameworkMap.ts";
import { describeToolUse } from "../lib/agent/activity.ts";
import type { ChatJob, ChatContext, ChatMessage, EmitFn } from "./types.ts";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-5";

// Aggregate token usage across all model requests in the run, into the same
// loose shape the client's `done` handler already tolerates.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumUsage(rawResponses: any[] | undefined) {
  let input = 0;
  let output = 0;
  let total = 0;
  for (const r of rawResponses ?? []) {
    const u = r?.usage;
    if (!u) continue;
    input += u.inputTokens ?? 0;
    output += u.outputTokens ?? 0;
    total += u.totalTokens ?? 0;
  }
  return { input_tokens: input, output_tokens: output, total_tokens: total };
}

function formatContext(ctx: ChatContext): string {
  if (ctx.kind === "question") {
    const { question: q, answer: a } = ctx;
    const lines = [
      `You are currently helping the user with question ${q.id} ("${q.label}") in section "${q.sectionTitle}" (${q.sectionId}).`,
      `Question type: ${q.questionKind}.`,
    ];
    if (q.description) lines.push(`Question description: ${q.description}`);
    if (a) {
      lines.push(
        `Current answer status: ${a.status} (${a.filledCount}/${a.totalFields} fields filled).`
      );
      if (a.preview) lines.push(`Current answer preview: ${a.preview}`);
    }
    lines.push(
      "When answering, factor this question's intent into your reply. If the user's question is ambiguous, assume it relates to this question."
    );
    return lines.join("\n");
  }
  const outlineLines = ctx.outline.length
    ? ctx.outline
        .map((it) => {
          const head = `[${it.id}] ${it.kind}`;
          if (it.kind === "heading") return `${head} (h${it.level ?? 2}): ${it.heading ?? ""}`;
          if (it.preview) return `${head}: ${it.preview}`;
          return head;
        })
        .join("\n")
    : "(empty document)";
  return [
    `You are currently helping the user with the document titled "${ctx.title}".`,
    `Here is the full document outline (block ids in brackets):`,
    outlineLines,
    "When answering, factor the document's contents into your reply. If the user references a section by name, locate it in the outline above.",
  ].join("\n");
}

// Build the conversation as proper input items. The optional `context` is
// injected into the LAST user message only (older turns get no context, since
// stale context would confuse the model) — same policy as the original.
function buildInput(
  messages: ChatMessage[],
  context: ChatContext | null | undefined
): AgentInputItem[] {
  const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
  const items: AgentInputItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "assistant") {
      items.push(assistant(m.content));
      continue;
    }
    if (i === lastUserIdx && context) {
      items.push(user(`<context>\n${formatContext(context)}\n</context>\n\n${m.content}`));
    } else {
      items.push(user(m.content));
    }
  }
  return items;
}

export async function handleChat(job: ChatJob, emit: EmitFn): Promise<void> {
  if (!job.messages?.length) {
    emit("error", { message: "messages is required" });
    return;
  }
  if (!job.messages.some((m) => m.role === "user")) {
    emit("error", { message: "No user message" });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    emit("error", { message: "OPENAI_API_KEY is not set in the sandbox env." });
    return;
  }

  const framework = resolveRagFramework(job.framework);
  const userDocs = job.userDocs ?? [];
  const abortController = new AbortController();

  // Dedupe sources across multiple search calls in one turn.
  const seenSources = new Set<string>();
  const onSearchHit = (sources: RetrievedSource[]) => {
    const fresh = sources.filter((s) => {
      const key = `${s.section}|${s.pages}`;
      if (seenSources.has(key)) return false;
      seenSources.add(key);
      return true;
    });
    if (fresh.length) emit("retrieved", fresh);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [
    makeSearchGuidanceTool(framework, { onSearchHit }),
    webSearchTool(),
  ];
  if (userDocs.length) {
    tools.push(makeSearchUserDocsTool(framework, userDocs, { onSearchHit }));
  }

  const agent = new Agent({
    name: `${framework}-chat`,
    instructions: getSystemPrompt(framework, "chat"),
    model: CHAT_MODEL,
    tools,
  });

  const seenToolCalls = new Set<string>();

  try {
    const stream = await run(agent, buildInput(job.messages, job.context ?? null), {
      stream: true,
      maxTurns: 16,
      signal: abortController.signal,
    });

    for await (const ev of stream) {
      if (ev.type === "raw_model_stream_event") {
        // Forward incremental assistant text to the client.
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
    emit("done", { usage: sumUsage(stream.rawResponses) });
  } catch (err) {
    emit("error", { message: err instanceof Error ? err.message : String(err) });
  } finally {
    abortController.abort();
  }
}
