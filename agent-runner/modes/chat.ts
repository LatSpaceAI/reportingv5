// Chat mode handler. Mirrors the body of the previous Next route at
// src/app/api/chat/route.ts (pre-dispatcher refactor) one-for-one — same
// agent options, same MCP server, same event types — except instead of
// pushing to a ReadableStream we call emit() which writes one NDJSON line
// per event to stdout.

import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { getSystemPrompt } from "../lib/guidance.ts";
import {
  createAgentMcpServer,
  toolSearchGuidance,
  type RetrievedSource,
} from "../lib/agent/tools.ts";
import { resolveRagFramework } from "../lib/agent/frameworkMap.ts";
import { describeToolUse } from "../lib/agent/activity.ts";
import type { ChatJob, ChatContext, ChatMessage, EmitFn } from "./types.ts";

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

// The streaming-input prompt only accepts user messages. To preserve prior
// assistant context across our stateless invocation, we fold each assistant
// turn into the *next* user turn as a bracketed note. This wastes some
// tokens vs. resuming a session, but keeps the runner stateless. The optional
// `context` argument is injected into the *final* user message only — older
// turns get no context, since stale context would confuse the model.
async function* historyAsPrompt(
  messages: ChatMessage[],
  context: ChatContext | null | undefined
): AsyncIterable<SDKUserMessage> {
  let pendingAssistant: string | null = null;
  const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "assistant") {
      pendingAssistant = m.content;
      continue;
    }
    const parts: string[] = [];
    if (i === lastUserIdx && context) {
      parts.push(`<context>\n${formatContext(context)}\n</context>`);
    }
    if (pendingAssistant) {
      parts.push(`[Earlier in this conversation, you replied: ${pendingAssistant}]`);
    }
    parts.push(m.content);
    pendingAssistant = null;
    yield {
      type: "user",
      message: { role: "user", content: parts.join("\n\n") } as MessageParam,
      parent_tool_use_id: null,
    };
  }
}

export async function handleChat(job: ChatJob, emit: EmitFn): Promise<void> {
  if (!job.messages?.length) {
    emit("error", { message: "messages is required" });
    return;
  }
  const lastUser = [...job.messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    emit("error", { message: "No user message" });
    return;
  }

  const framework = resolveRagFramework(job.framework);
  const abortController = new AbortController();

  // Source dedupe across multiple search_guidance calls in one turn.
  // Section+pages identifies a chunk well enough for UI purposes.
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

  const mcpServer = createAgentMcpServer(framework, { onSearchHit });

  const q = query({
    prompt: historyAsPrompt(job.messages, job.context ?? null),
    options: {
      model: "claude-opus-4-7",
      systemPrompt: getSystemPrompt(framework, "chat"),
      mcpServers: { [framework]: mcpServer },
      allowedTools: [toolSearchGuidance(framework), "WebSearch", "WebFetch"],
      tools: ["WebSearch", "WebFetch"],
      settingSources: [],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      persistSession: false,
      includePartialMessages: false,
      // 16 turns. Compound regulatory questions sometimes need a long
      // chain — search guidance, refine query, cross-reference an
      // external standard via WebSearch, fetch a specific page, then
      // synthesize. Pro's 800 s function ceiling gives us plenty of
      // wall time for this; the bigger risk at high turn counts is
      // tokens, not seconds. Drop to 4 on Hobby — see DEPLOY.md plan
      // tuning.
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
          const t = r.content?.[0]?.text ?? "tool error";
          toolErrorMessages.push(t);
        }
      } else if (msg.type === "result") {
        if (msg.subtype === "success") {
          emit("done", {
            stop_reason: msg.stop_reason,
            usage: msg.usage,
            cost_usd: msg.total_cost_usd,
          });
        } else {
          const errs = [...(msg.errors ?? []), ...toolErrorMessages];
          const message = errs.join(" | ") || msg.subtype;
          emit("error", { message });
        }
      }
    }
  } finally {
    abortController.abort();
  }
}
