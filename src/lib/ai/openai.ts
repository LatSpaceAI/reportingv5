import "server-only";
import OpenAI from "openai";

/**
 * Lazily-constructed OpenAI client for the AI Dashboard route.
 *
 * plato-v1 is otherwise an Anthropic project (the chat/write agents run on the
 * Claude Agent SDK inside a Vercel Sandbox). The dashboard's chart-spec
 * generation runs in-process on the Next.js server and uses OpenAI, so this is
 * the one place an OpenAI key is read. Server-only — never import on the client.
 */
let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  _client = new OpenAI({ apiKey });
  return _client;
}

// gpt-4.1 — best balance of tool-use accuracy and latency for single-shot
// chart-spec generation (same choice as the sibling vsmev1 dashboard).
export const DASHBOARD_MODEL = "gpt-4.1";
