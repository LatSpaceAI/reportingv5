// User-uploaded-document retrieval — the runtime counterpart to retrieval.ts
// for PDFs the user uploads on the AI-Context tab.
//
// Each uploaded PDF is ingested by /api/ingest into a self-contained index JSON
// written to Vercel Blob at rag/user/<docId>/index.json. The chat/write job
// carries only the Blob URLs (keeping JOB_JSON small); this module fetches and
// caches each index in-process, merges all the user's docs into one searchable
// index, and runs the same fuseSearch() the framework index uses.
//
// The sandbox firewall already allows *.public.blob.vercel-storage.com, so the
// fetch works without any network-policy change.

import {
  buildBm25Index,
  fuseSearch,
  tokenize,
  type Bm25Index,
  type RagChunk,
  type RetrievedChunk,
  type SearchOptions,
} from "./core.ts";
import { embedQuery } from "../retrieval.ts";

type VoyageClient = Parameters<typeof embedQuery>[0];

export interface UserDocRef {
  id: string;
  name: string;
  blobUrl: string;
}

interface UserIndexFile {
  version: number;
  docId: string;
  docName: string;
  embedModel: string;
  chunks: RagChunk[];
  vectors: number[][];
  bm25: Bm25Index;
}

// Module-level cache keyed by blobUrl. The sandbox process is ephemeral (one
// per turn) so there's no staleness risk; the cache just avoids re-fetching the
// same index across multiple search_user_docs calls within a single turn.
const indexCache = new Map<string, UserIndexFile>();

async function loadUserIndex(blobUrl: string): Promise<UserIndexFile | null> {
  const cached = indexCache.get(blobUrl);
  if (cached) return cached;
  try {
    const resp = await fetch(blobUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const parsed = (await resp.json()) as UserIndexFile;
    if (!Array.isArray(parsed.chunks) || !Array.isArray(parsed.vectors)) {
      throw new Error("malformed index");
    }
    indexCache.set(blobUrl, parsed);
    return parsed;
  } catch (err) {
    // A single bad doc shouldn't kill the whole search — log to stderr (stdout
    // is the NDJSON channel) and skip it.
    process.stderr.write(
      `[userIndex] failed to load ${blobUrl}: ${err instanceof Error ? err.message : String(err)}\n`
    );
    return null;
  }
}

// Merge several per-doc indexes into one searchable index. Dense vectors concat
// trivially (cosine is corpus-independent). BM25 must be rebuilt across the
// merged corpus because IDF/avgLen are corpus-relative — but that's cheap at the
// tens-to-low-hundreds-of-chunks scale of user uploads, and it keeps the merged
// ranking comparable for RRF (per-doc top-k lists have non-comparable ranks).
function mergeIndexes(files: UserIndexFile[]): {
  chunks: RagChunk[];
  vectors: number[][];
  bm25: Bm25Index;
} {
  const chunks: RagChunk[] = [];
  const vectors: number[][] = [];
  for (const f of files) {
    for (let i = 0; i < f.chunks.length; i++) {
      // Carry docName so excerpts can be cited; defensively backfill from file.
      chunks.push({ ...f.chunks[i], docName: f.chunks[i].docName ?? f.docName, docId: f.chunks[i].docId ?? f.docId });
      vectors.push(f.vectors[i]);
    }
  }
  const bm25 = buildBm25Index(chunks);
  return { chunks, vectors, bm25 };
}

export interface UserDocHit extends RetrievedChunk {
  docName: string;
}

/**
 * Search across all of the user's uploaded documents. Loads (cached) each doc's
 * index from Blob, merges them, embeds the query once, and runs the shared
 * fuse-and-rank core. Returns top-k hits tagged with their source doc.
 */
export async function searchUserDocs(
  query: string,
  docs: UserDocRef[],
  voyage: VoyageClient,
  options: SearchOptions = {}
): Promise<UserDocHit[]> {
  const loaded = (await Promise.all(docs.map((d) => loadUserIndex(d.blobUrl)))).filter(
    (f): f is UserIndexFile => f !== null
  );
  if (!loaded.length) return [];

  const merged = mergeIndexes(loaded);
  const [queryVec, queryTokens] = await Promise.all([
    embedQuery(voyage, query),
    Promise.resolve(tokenize(query)),
  ]);

  const hits = fuseSearch(merged, queryVec, queryTokens, options);
  return hits.map((h) => ({ ...h, docName: h.docName ?? "uploaded document" }));
}
