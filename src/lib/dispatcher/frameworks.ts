// Framework resolver shared between dispatcher routes (this file) and the
// agent runner (agent-runner/lib/agent/frameworkMap.ts). Kept intentionally
// duplicated as a 7-line pure function — pulling in a shared sub-package adds
// machinery for no real benefit. If the rules diverge the duplication will
// be obvious; today they don't.

export type Framework = "cbam" | "cdp" | "brsr";

export function resolveRagFramework(frameworkId: string | undefined | null): Framework {
  if (!frameworkId) return "cbam";
  const id = frameworkId.toLowerCase();
  if (id === "cdp") return "cdp";
  if (id === "brsr") return "brsr";
  return "cbam";
}
