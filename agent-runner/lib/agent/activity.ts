// Maps a tool_use block to a user-facing activity event for the AI Assistant
// pane. The agent emits these events as it works so the user can see what's
// happening (searching guidance, running a web search, fetching a URL, etc.)
// instead of a single static "thinking" placeholder.

import type { Framework } from "../retrieval.ts";

export interface AgentActivity {
  // High-level kind drives the icon/color in the UI.
  kind: "guidance" | "websearch" | "webfetch" | "propose" | "tool";
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
    framework === "cdp"
      ? "CDP guidance"
      : framework === "brsr"
        ? "BRSR guidance"
        : "CBAM guidance";

  // MCP tool names look like `mcp__<server>__<name>`.
  if (toolName.endsWith("__search_guidance")) {
    const q = typeof args.query === "string" ? args.query : "";
    return { kind: "guidance", label: `Searching ${docName}`, detail: q || undefined };
  }
  if (toolName.endsWith("__propose_insert")) {
    return { kind: "propose", label: "Drafting insertion" };
  }
  if (toolName === "WebSearch") {
    const q = typeof args.query === "string" ? args.query : "";
    return { kind: "websearch", label: "Searching the web", detail: q || undefined };
  }
  if (toolName === "WebFetch") {
    const url = typeof args.url === "string" ? args.url : "";
    return { kind: "webfetch", label: "Fetching page", detail: url || undefined };
  }
  return { kind: "tool", label: toolName };
}
