import { NextRequest } from "next/server";
import { dispatchToSandbox } from "@/lib/dispatcher/sandbox";
import { resolveRagFramework } from "@/lib/dispatcher/frameworks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby plan caps function execution at 60 s. The dispatcher route
// holds the response stream open for the whole agent run, so 60 s is also
// the hard ceiling on how long the agent gets to think before Vercel kills
// the function and the user sees a truncated answer. To keep agent runs
// under that ceiling we cap maxTurns aggressively in the runner — see
// agent-runner/modes/{chat,write}.ts. When upgrading to Pro, raise this to
// 800 (Pro Fluid Compute streaming cap) and re-loosen maxTurns.
export const maxDuration = 60;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  framework?: string;
  context?: unknown;
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

  // Pin the framework on the dispatcher side so the sandbox doesn't have to
  // re-validate; the runner trusts what we pass in.
  const framework = resolveRagFramework(body.framework);

  return dispatchToSandbox({
    job: {
      mode: "chat",
      messages: body.messages,
      framework,
      context: body.context ?? null,
    },
  });
}
