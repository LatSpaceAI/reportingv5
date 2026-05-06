import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/anthropic/guidance";
import { search, type RetrievedChunk } from "@/lib/anthropic/retrieval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

const client = new Anthropic();

function formatRetrievedExcerpts(chunks: RetrievedChunk[]): string {
  // Render the retrieved chunks as a single block the model can quote from.
  // The section number + page range are mandatory because the system prompt
  // instructs the model to cite them.
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

  // The latest user message is what we retrieve against. Earlier turns are
  // conversation history; the model gets them verbatim. (A more elaborate
  // pipeline would rewrite the latest user query in light of history before
  // retrieval — defer that until evals show it's needed.)
  const latestUser = [...body.messages].reverse().find((m) => m.role === "user");
  if (!latestUser) {
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

      try {
        // 1. Retrieve.
        const retrieved = await search(latestUser.content, { k: 6 });
        send(
          "retrieved",
          retrieved.map((r) => ({
            section: `§${r.sectionNumber}`,
            title: r.sectionTitle,
            pages:
              r.firstPage === r.lastPage
                ? `p${r.firstPage}`
                : `p${r.firstPage}-${r.lastPage}`,
            score: Number(r.fusedScore.toFixed(4)),
          }))
        );

        // 2. Build the messages array. We attach the retrieved excerpts to the
        // latest user turn only. Every turn re-retrieves, so older turns'
        // excerpts are stale — including them would waste tokens and confuse
        // the model with conflicting context.
        const messages: Anthropic.MessageParam[] = body.messages.map((m, idx) => {
          const isLatestUser = idx === body.messages.length - 1 && m.role === "user";
          if (!isLatestUser) return { role: m.role, content: m.content };
          const excerpts = formatRetrievedExcerpts(retrieved);
          return {
            role: "user",
            content: `Here are excerpts from the CBAM guidance document retrieved for this question. Use them as your primary source.

${excerpts}

---

User question: ${m.content}`,
          };
        });

        // 3. Stream the model response.
        const sdkStream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages,
        });

        for await (const event of sdkStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send("text", { text: event.delta.text });
          }
        }

        const final = await sdkStream.finalMessage();
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
