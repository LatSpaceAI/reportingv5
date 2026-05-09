// Maps the frontend's framework registry id (cbam, cbam-mmd, cdp, brsr, ...)
// to the RAG framework key whose index we should query. CBAM and its MMD
// variant share the CBAM guidance document; CDP and BRSR each have their
// own. Frameworks without a dedicated RAG index fall back to CBAM — those
// reports don't currently surface the AI assistant in production paths, but
// the fallback keeps the route from 500-ing if a stray request comes through.

import type { Framework } from "../retrieval.ts";

export function resolveRagFramework(frameworkId: string | undefined | null): Framework {
  if (!frameworkId) return "cbam";
  const id = frameworkId.toLowerCase();
  if (id === "cdp") return "cdp";
  if (id === "brsr") return "brsr";
  // cbam, cbam-mmd, and any other id default to the CBAM index.
  return "cbam";
}
