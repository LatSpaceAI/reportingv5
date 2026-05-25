// Framework resolver shared between dispatcher routes (this file) and the
// agent runner (agent-runner/lib/agent/frameworkMap.ts). Kept intentionally
// duplicated as a pure function — pulling in a shared sub-package adds
// machinery for no real benefit. If the rules diverge the duplication will
// be obvious; today they don't.

export type Framework = "cbam" | "ccts";

export function resolveRagFramework(frameworkId: string | undefined | null): Framework {
  return frameworkId === "ccts" ? "ccts" : "cbam";
}
