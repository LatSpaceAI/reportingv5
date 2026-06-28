// Client for the "Fill with AI" feature. POSTs a fill request to /api/fill and
// parses the NDJSON event stream the sandbox dispatcher returns. Mirrors the
// event vocabulary used by the chat/write assistant (see AssistantPane) so the
// transport is consistent: `sandbox`, `activity`, `fill_proposal`, `done`,
// `error`.

import { readReadyUserDocs } from "@/lib/userDocs";
import { readAiContext } from "@/lib/aiContext";

export interface ProposedField {
  fieldId: string;
  value: string | number | boolean | null;
  confidence: number;
  source: string;
  rationale?: string;
}

export interface FillProposal {
  questionId: string;
  fields: ProposedField[];
  rows?: ProposedField[][];
  unfilled?: { fieldId: string; reason: string }[];
}

export interface FillCallbacks {
  onActivity?: (text: string) => void;
  onProposal?: (proposal: FillProposal) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

export interface FillRequestQuestion {
  id: string;
  existingValues?: Record<string, unknown>;
}

export interface RunFillOptions {
  frameworkId: string;
  questions: FillRequestQuestion[];
  /** Whether to let the agent query the Supabase ESG database. Default true. */
  useEsgDb?: boolean;
  signal?: AbortSignal;
}

interface NdjsonEvent {
  event: string;
  data: unknown;
}

/**
 * Run a fill request. Streams events to the provided callbacks. Resolves when
 * the stream ends (after `done` or `error`). Throws only on a hard network /
 * non-OK-response failure before the stream begins.
 */
export async function runFill(
  opts: RunFillOptions,
  cb: FillCallbacks
): Promise<void> {
  const userDocs = readReadyUserDocs().map((d) => ({
    id: d.id,
    name: d.name,
    blobUrl: d.blobUrl,
  }));
  const profile = readAiContext();
  const aiContext = profile
    ? {
        companyName: profile.companyName,
        websiteUrl: profile.websiteUrl,
        reportingYear: profile.reportingYear,
        businessContext: profile.businessContext,
      }
    : undefined;

  const resp = await fetch("/api/fill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      framework: opts.frameworkId,
      questions: opts.questions,
      userDocs,
      aiContext,
      useEsgDb: opts.useEsgDb ?? true,
    }),
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    throw new Error(text || `Fill request failed (${resp.status})`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  const handle = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let ev: NdjsonEvent;
    try {
      ev = JSON.parse(trimmed) as NdjsonEvent;
    } catch {
      return; // ignore malformed line
    }
    switch (ev.event) {
      case "sandbox":
        cb.onActivity?.("Starting AI…");
        break;
      case "activity": {
        const text =
          typeof ev.data === "string"
            ? ev.data
            : (ev.data as { text?: string })?.text;
        if (text) cb.onActivity?.(text);
        break;
      }
      case "fill_proposal":
        cb.onProposal?.(ev.data as FillProposal);
        break;
      case "done":
        cb.onDone?.();
        break;
      case "error":
        cb.onError?.(
          (ev.data as { message?: string })?.message ?? "Unknown error"
        );
        break;
      default:
        break;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      handle(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
  if (buf) handle(buf);
}
