// User-uploaded documents — metadata for the PDFs the user uploads on the
// AI-Context tab as RAG knowledge for the AI agents.
//
// The heavy artifacts (chunks + vectors + BM25) live in Vercel Blob, written by
// /api/ingest. Only this lightweight metadata list is kept client-side in
// localStorage, mirroring the AI Context profile pattern in lib/aiContext.ts
// (plato-v1 has no auth/DB). The metadata carries the Blob URL, which the
// AssistantPane sends with each chat/write request so the agent can retrieve
// from the docs via search_user_docs.

export const USER_DOCS_KEY = "reporting-app/ai-context/user-docs/v1";

/** Fired after the doc list changes so same-tab listeners can re-read it.
 *  (The native `storage` event only fires across tabs, not the writer's.) */
export const USER_DOCS_UPDATED_EVENT = "ai-context-docs:updated";

export type UserDocStatus = "uploading" | "ready" | "failed";

export interface UserDocMeta {
  /** Server-generated doc id (also the Blob path segment). For an in-flight
   *  upload this is a temporary client id until the server responds. */
  id: string;
  /** Original filename. */
  name: string;
  /** Public Blob URL of the index JSON. Empty until ingest succeeds. */
  blobUrl: string;
  chunkCount: number;
  pageCount: number;
  /** Source PDF size in bytes. */
  sizeBytes: number;
  status: UserDocStatus;
  /** Populated when status is "failed". */
  error?: string;
  /** Non-fatal note (e.g. truncated pages). */
  warning?: string;
  /** ISO timestamp of the last status change. */
  updatedAt: string;
}

function notify(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USER_DOCS_UPDATED_EVENT));
}

/** Read the saved user-doc list (empty array if none/unreadable). */
export function readUserDocs(): UserDocMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_DOCS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UserDocMeta[]) : [];
  } catch {
    return [];
  }
}

/** Only the docs the agent can actually retrieve from (ingested + has a URL). */
export function readReadyUserDocs(): UserDocMeta[] {
  return readUserDocs().filter((d) => d.status === "ready" && d.blobUrl);
}

/** Persist the full list. */
export function writeUserDocs(docs: UserDocMeta[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(USER_DOCS_KEY, JSON.stringify(docs));
  } catch {}
  notify();
}

/** Insert or replace a doc by id, then persist. Returns the new list. */
export function upsertUserDoc(doc: UserDocMeta): UserDocMeta[] {
  const docs = readUserDocs();
  const idx = docs.findIndex((d) => d.id === doc.id);
  if (idx === -1) docs.push(doc);
  else docs[idx] = doc;
  writeUserDocs(docs);
  return docs;
}

/** Remove a doc by id, then persist. Returns the new list. (Blob is orphaned;
 *  acceptable with no DB — see plan.) */
export function removeUserDoc(id: string): UserDocMeta[] {
  const docs = readUserDocs().filter((d) => d.id !== id);
  writeUserDocs(docs);
  return docs;
}
