import { NextRequest } from "next/server";
import { dispatchToSandbox } from "@/lib/dispatcher/sandbox";
import { resolveRagFramework } from "@/lib/dispatcher/frameworks";
import { sanitizeUserDocs } from "@/lib/dispatcher/userDocs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// See chat/route.ts for the 800 s rationale (Pro Fluid Compute streaming cap).
export const maxDuration = 800;

interface OutlineItem {
  id: string;
  kind:
    | "heading"
    | "paragraph"
    | "table"
    | "requirement-ref"
    | "data-ref"
    | "section-marker"
    | "diagram";
  level?: 1 | 2 | 3;
  heading?: string;
  preview?: string;
}

interface WriteRequest {
  instruction: string;
  outline: OutlineItem[];
  framework?: string;
  userDocs?: unknown;
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

  const framework = resolveRagFramework(body.framework);

  return dispatchToSandbox({
    job: {
      mode: "write",
      instruction: body.instruction,
      outline: body.outline,
      framework,
      userDocs: sanitizeUserDocs(body.userDocs),
    },
  });
}
