// Maps the frontend's framework registry id (cbam, cbam-mmd, ...) to the RAG
// framework key whose index we should query. CBAM and its MMD variant share
// the CBAM guidance document. Frameworks without a dedicated RAG index fall
// back to CBAM — those reports don't currently surface the AI assistant in
// production paths, but the fallback keeps the route from 500-ing if a stray
// request comes through.

import type { Framework } from "../retrieval.ts";

export function resolveRagFramework(frameworkId: string | undefined | null): Framework {
  return frameworkId === "ccts" ? "ccts" : "cbam";
}
