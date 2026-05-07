import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { NextRequest } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/anthropic/guidance";
import {
  createCbamMcpServer,
  TOOL_SEARCH_GUIDANCE,
  type RetrievedSource,
} from "@/lib/anthropic/agent/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

// The streaming-input prompt only accepts user messages. To preserve prior
// assistant context across our stateless route, we fold each assistant turn
// into the *next* user turn as a bracketed note. This wastes some tokens vs.
// resuming a session, but keeps the route stateless.
async function* historyAsPrompt(messages: ChatMessage[]): AsyncIterable<SDKUserMessage> {
  let pendingAssistant: string | null = null;
  for (const m of messages) {
    if (m.role === "assistant") {
      pendingAssistant = m.content;
      continue;
    }
    const text = pendingAssistant
      ? `[Earlier in this conversation, you replied: ${pendingAssistant}]\n\n${m.content}`
      : m.content;
    pendingAssistant = null;
    yield {
      type: "user",
      message: { role: "user", content: text } as MessageParam,
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

      const mcpServer = createCbamMcpServer({ onSearchHit });

      try {
        const q = query({
          prompt: historyAsPrompt(body.messages),
          options: {
            model: "claude-opus-4-7",
            systemPrompt: SYSTEM_PROMPT,
            mcpServers: { cbam: mcpServer },
            allowedTools: [TOOL_SEARCH_GUIDANCE],
            tools: [], // no built-in tools (Read/Bash/etc.)
            settingSources: [], // ignore ~/.claude and project settings
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            persistSession: false, // ephemeral, no JSONL on disk
            includePartialMessages: false,
            maxTurns: 8,
            abortController,
            env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: "cbam-app/1.0" },
          },
        });

        // Track which assistant message blocks we've already streamed so we
        // don't re-emit text on retries / duplicate sends.
        const seenBlockText = new Map<string, number>(); // uuid -> last index
        let toolErrorMessages: string[] = [];

        for await (const msg of q) {
          if (msg.type === "assistant") {
            const blocks = msg.message.content ?? [];
            const acc: string[] = [];
            for (const b of blocks) {
              if (b.type === "text") acc.push(b.text);
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
