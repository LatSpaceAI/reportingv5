import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { NextRequest } from "next/server";
import { getSystemPrompt } from "@/lib/anthropic/guidance";
import {
  createAgentMcpServer,
  toolSearchGuidance,
  type RetrievedSource,
} from "@/lib/anthropic/agent/tools";
import { resolveRagFramework } from "@/lib/anthropic/agent/frameworkMap";
import { describeToolUse } from "@/lib/anthropic/agent/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface QuestionContext {
  kind: "question";
  question: {
    id: string;
    label: string;
    sectionId: string;
    sectionTitle: string;
    questionKind: "fields" | "table";
    description?: string;
  };
  answer?: {
    status: "not-started" | "in-progress" | "completed";
    filledCount: number;
    totalFields: number;
    preview?: string;
  };
}

interface DocumentContext {
  kind: "document";
  title: string;
  outline: Array<{
    id: string;
    kind: string;
    level?: 1 | 2 | 3;
    heading?: string;
    preview?: string;
  }>;
}

type ChatContext = QuestionContext | DocumentContext;

interface ChatRequest {
  messages: ChatMessage[];
  framework?: string;
  context?: ChatContext | null;
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

// The streaming-input prompt only accepts user messages. To preserve prior
// assistant context across our stateless route, we fold each assistant turn
// into the *next* user turn as a bracketed note. This wastes some tokens vs.
// resuming a session, but keeps the route stateless. The optional `context`
// argument is injected into the *final* user message only — older turns get
// no context, since stale context would confuse the model.
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

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body.messages?.length) {
    return new Response("messages is required", { status: 400 });
  }
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return new Response("No user message", { status: 400 });
  }

  const framework = resolveRagFramework(body.framework);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

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
        if (fresh.length) send("retrieved", fresh);
      };

      const mcpServer = createAgentMcpServer(framework, { onSearchHit });

      try {
        const q = query({
          prompt: historyAsPrompt(body.messages, body.context ?? null),
          options: {
            model: "claude-opus-4-7",
            systemPrompt: getSystemPrompt(framework, "chat"),
            mcpServers: { [framework]: mcpServer },
            allowedTools: [toolSearchGuidance(framework), "WebSearch", "WebFetch"],
            tools: ["WebSearch", "WebFetch"], // built-ins limited to web — no Read/Bash/etc.
            settingSources: [], // ignore ~/.claude and project settings
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            persistSession: false, // ephemeral, no JSONL on disk
            includePartialMessages: false,
            maxTurns: 8,
            abortController,
            env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: `${framework}-app/1.0` },
          },
        });

        // Track which assistant message blocks we've already streamed so we
        // don't re-emit text on retries / duplicate sends.
        const seenBlockText = new Map<string, number>(); // uuid -> last index
        const seenToolUseIds = new Set<string>();
        const toolErrorMessages: string[] = [];

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
                  send("activity", describeToolUse(b.name, b.input, framework));
                }
              }
            }
            const fullText = acc.join("");
            const prev = seenBlockText.get(msg.uuid) ?? 0;
            if (fullText.length > prev) {
              const delta = fullText.slice(prev);
              seenBlockText.set(msg.uuid, fullText.length);
              if (delta) send("text", { text: delta });
            }
          } else if (msg.type === "user" && msg.tool_use_result !== undefined) {
            // Tool result echoed back as a user message. We capture errors
            // here so we can surface them if the agent never recovers; the
            // search_guidance handler already sets isError on its own.
            const r = msg.tool_use_result as { isError?: boolean; content?: Array<{ text?: string }> } | undefined;
            if (r?.isError) {
              const t = r.content?.[0]?.text ?? "tool error";
              toolErrorMessages.push(t);
            }
          } else if (msg.type === "result") {
            if (msg.subtype === "success") {
              send("done", {
                stop_reason: msg.stop_reason,
                usage: msg.usage,
                cost_usd: msg.total_cost_usd,
              });
            } else {
              const errs = [...(msg.errors ?? []), ...toolErrorMessages];
              const message = errs.join(" | ") || msg.subtype;
              send("error", { message });
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send("error", { message });
      } finally {
        abortController.abort();
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
