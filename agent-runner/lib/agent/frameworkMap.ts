// Maps the frontend's framework registry id (cdp, brsr, ...) to the RAG
// framework key whose index we should query. CDP and BRSR each have their
// own guidance document. Frameworks without a dedicated RAG index fall back
// to CDP — those reports don't currently surface the AI assistant in
// production paths, but the fallback keeps the route from 500-ing if a stray
// request comes through.

import type { Framework } from "../retrieval.ts";

export function resolveRagFramework(frameworkId: string | undefined | null): Framework {
  if (!frameworkId) return "cdp";
  const id = frameworkId.toLowerCase();
  if (id === "brsr") return "brsr";
  // cdp and any other id default to the CDP index.
  return "cdp";
}
