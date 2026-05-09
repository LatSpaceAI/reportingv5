import { NextRequest } from "next/server";
import { dispatchToSandbox } from "@/lib/dispatcher/sandbox";
import { resolveRagFramework } from "@/lib/dispatcher/frameworks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Pro Fluid Compute streaming cap. The dispatcher route holds the
// response stream open for the whole agent run; the sandbox itself can run
// much longer (up to 5 hours on Pro), but the route can only stream for
// maxDuration seconds before Vercel closes the function. 800 s is the cap.
// On Hobby this drops to 60 s, see the `Plan tuning` section in DEPLOY.md.
export const maxDuration = 800;

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
