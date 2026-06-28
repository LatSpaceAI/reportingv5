// Maps a tool_use block to a user-facing activity event for the AI Assistant
// pane. The agent emits these events as it works so the user can see what's
// happening (searching guidance, running a web search, fetching a URL, etc.)
// instead of a single static "thinking" placeholder.

import type { Framework } from "../retrieval.ts";

export interface AgentActivity {
  // High-level kind drives the icon/color in the UI.
  kind: "guidance" | "userdoc" | "websearch" | "webfetch" | "propose" | "tool";
  // One-line, present-tense description shown to the user.
  label: string;
  // Optional secondary text — e.g. the search query or the fetched URL.
  detail?: string;
}

export function describeToolUse(
  toolName: string,
  input: unknown,
  framework: Framework
): AgentActivity {
  const args = (input ?? {}) as Record<string, unknown>;
  const docName =
    framework === "brsr"
      ? "BRSR guidance"
      : "CDP guidance";

  // Match both Claude MCP names (`mcp__<server>__search_guidance`) and the bare
  // OpenAI Agents SDK names (`search_guidance`). `endsWith` covers the suffix;
  // an exact-match fallback covers the bare form.
  const is = (suffix: string) =>
    toolName === suffix || toolName.endsWith(`__${suffix}`);

  if (is("search_guidance")) {
    const q = typeof args.query === "string" ? args.query : "";
    return { kind: "guidance", label: `Searching ${docName}`, detail: q || undefined };
  }
  if (is("search_user_docs")) {
    const q = typeof args.query === "string" ? args.query : "";
    return { kind: "userdoc", label: "Searching uploaded documents", detail: q || undefined };
  }
  if (is("propose_insert")) {
    return { kind: "propose", label: "Drafting insertion" };
  }
  // Web search: Claude exposes "WebSearch"; OpenAI's hosted tool surfaces as
  // "web_search" / "web_search_preview".
  if (toolName === "WebSearch" || toolName === "web_search" || toolName === "web_search_preview") {
    const q = typeof args.query === "string" ? args.query : "";
    return { kind: "websearch", label: "Searching the web", detail: q || undefined };
  }
  if (toolName === "WebFetch") {
    const url = typeof args.url === "string" ? args.url : "";
    return { kind: "webfetch", label: "Fetching page", detail: url || undefined };
  }
  // ESG database tools (fill mode).
  if (toolName.startsWith("esg_")) {
    return { kind: "tool", label: "Querying ESG database" };
  }
  return { kind: "tool", label: toolName };
}
