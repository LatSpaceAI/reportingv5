import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { NextRequest } from "next/server";
import path from "node:path";
import { WRITE_SYSTEM_PROMPT } from "@/lib/anthropic/guidance";
import {
  createCbamMcpServer,
  TOOL_PROPOSE_INSERT,
  TOOL_SEARCH_GUIDANCE,
  type ProposalBlocks,
  type RetrievedSource,
} from "@/lib/anthropic/agent/tools";

function resolveClaudeBinary(): string | undefined {
  if (process.platform !== "linux") return undefined;
  try {
    const pkgJson = require.resolve("@anthropic-ai/claude-code-linux-x64/package.json");
    return path.join(path.dirname(pkgJson), "claude");
  } catch {
    return undefined;
  }
}
const CLAUDE_BIN = resolveClaudeBinary();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OutlineItem {
  id: string;
  kind: "heading" | "paragraph" | "table" | "requirement-ref" | "data-ref" | "section-marker" | "diagram";
  level?: 1 | 2 | 3;
  heading?: string;
  preview?: string;
}

interface WriteRequest {
  instruction: string;
  outline: OutlineItem[];
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

  const outlineText = formatOutline(body.outline);
  const userText = `Here is the current report outline (block ids in brackets — use them as after_block_id values):

<outline>
${outlineText}
</outline>

---

User instruction: ${body.instruction.trim()}

Search the guidance for any regulatory facts you need, then call propose_insert exactly once with the drafted blocks.`;

  async function* once(): AsyncIterable<SDKUserMessage> {
    yield {
      type: "user",
      message: { role: "user", content: userText } as MessageParam,
      parent_tool_use_id: null,
    };
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
      const outlineIds = new Set(body.outline.map((it) => it.id));
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
          send("retrieved", fresh);
        }
      };

      let proposal: ProposalBlocks | null = null;
      const onProposal = (p: ProposalBlocks) => {
        proposal = p;
      };

      const mcpServer = createCbamMcpServer({
        onSearchHit,
        outlineIds,
        onProposal,
      });

      try {
        const q = query({
          prompt: once(),
          options: {
            model: "claude-opus-4-7",
            systemPrompt: WRITE_SYSTEM_PROMPT,
            mcpServers: { cbam: mcpServer },
            allowedTools: [TOOL_SEARCH_GUIDANCE, TOOL_PROPOSE_INSERT],
            tools: [],
            settingSources: [],
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            persistSession: false,
            includePartialMessages: false,
            maxTurns: 8,
            abortController,
            env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: "cbam-app/1.0" },
            ...(CLAUDE_BIN ? { pathToClaudeCodeExecutable: CLAUDE_BIN } : {}),
          },
        });

        const seenBlockText = new Map<string, number>();
        const toolErrorMessages: string[] = [];

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
            const r = msg.tool_use_result as { isError?: boolean; content?: Array<{ text?: string }> } | undefined;
            if (r?.isError) {
              toolErrorMessages.push(r.content?.[0]?.text ?? "tool error");
            }
          } else if (msg.type === "result") {
            if (msg.subtype !== "success") {
              const errs = [...(msg.errors ?? []), ...toolErrorMessages];
              send("error", { message: errs.join(" | ") || msg.subtype });
              break;
            }
            if (!proposal) {
              send("error", { message: "Model did not call propose_insert." });
              break;
            }
            send("proposal", {
              after_block_id: (proposal as ProposalBlocks).after_block_id,
              blocks: (proposal as ProposalBlocks).blocks,
              rationale: (proposal as ProposalBlocks).rationale,
              sources: allSources.map(({ section, title, pages }) => ({ section, title, pages })),
            });
            send("done", {
              stop_reason: msg.stop_reason,
              usage: msg.usage,
              cost_usd: msg.total_cost_usd,
            });
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
