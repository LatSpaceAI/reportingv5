import { NextRequest } from "next/server";
import { dispatchToSandbox } from "@/lib/dispatcher/sandbox";
import { resolveRagFramework } from "@/lib/dispatcher/frameworks";
import { sanitizeUserDocs } from "@/lib/dispatcher/userDocs";
import { buildFillQuestionSpec } from "@/lib/dispatcher/fillSchema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// See chat/route.ts for the 800 s rationale (Pro Fluid Compute streaming cap).
export const maxDuration = 800;

interface FillRequestQuestion {
  id: string;
  /** Current values the user has already entered, keyed by field id. */
  existingValues?: Record<string, unknown>;
}

interface FillRequest {
  framework?: string;
  questions: FillRequestQuestion[];
  userDocs?: unknown;
  aiContext?: {
    companyName?: string;
    websiteUrl?: string;
    reportingYear?: number | null;
    businessContext?: string;
  };
  /** Whether to let the agent query the Supabase ESG database. */
  useEsgDb?: boolean;
}

export async function POST(req: NextRequest) {
  let body: FillRequest;
  try {
    body = (await req.json()) as FillRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    return new Response("questions is required (non-empty array)", { status: 400 });
  }
  if (body.questions.length > 10) {
    return new Response("Too many questions (max 10 per request)", { status: 400 });
  }

  const framework = resolveRagFramework(body.framework);

  // Resolve each question id to a self-describing spec from the canonical
  // section data. Unknown ids are dropped; if none resolve, bail.
  const questions = body.questions
    .map((q) =>
      buildFillQuestionSpec(framework, q.id, q.existingValues)
    )
    .filter((q): q is NonNullable<typeof q> => q !== null);

  if (questions.length === 0) {
    return new Response("No known questions to fill for this framework", {
      status: 400,
    });
  }

  // Only enable ESG DB access when the client asked AND the server is
  // configured for it — the runner re-checks too, but this avoids a useless
  // sandbox round-trip when Supabase isn't set up.
  const useEsgDb =
    Boolean(body.useEsgDb) &&
    Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    );

  return dispatchToSandbox({
    job: {
      mode: "fill",
      framework,
      questions,
      userDocs: sanitizeUserDocs(body.userDocs),
      aiContext: body.aiContext,
      useEsgDb,
    },
  });
}
