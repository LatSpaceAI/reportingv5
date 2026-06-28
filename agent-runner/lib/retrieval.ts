// Retrieval module — loads the prebuilt RAG index (chunks + dense vectors +
// BM25) once per process and exposes a hybrid search() that fuses dense +
// sparse results via Reciprocal Rank Fusion.
//
// The index is built offline by scripts/build-index.mjs and lives in
// agent-runner/data/rag/<framework>/. Inside the Vercel Sandbox the runner is
// extracted to /vercel/sandbox, so process.cwd() resolves to that path and
// the index files load from /vercel/sandbox/data/rag/<framework>/...
//
// The fuse-and-rank core (cosine + BM25 + RRF) and the text sanitizers now live
// in ./rag/core.ts so the user-uploaded-doc index (./rag/userIndex.ts) can
// reuse exactly the same scoring. This file is the framework-index wrapper:
// disk loading + Voyage query embedding + a search() that calls fuseSearch.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

import {
  fuseSearch,
  sanitizeQuery,
  tokenize,
  type Bm25Index,
  type RagChunk,
  type RetrievedChunk as CoreRetrievedChunk,
  type SearchOptions,
} from "./rag/core.ts";

// Voyage's ESM build does directory imports (e.g. `from "./api"` instead of
// `from "./api/index.js"`) which Node's native ESM resolver rejects with
// ERR_UNSUPPORTED_DIR_IMPORT. The CJS entry doesn't have this problem, so
// we force CJS via createRequire — same pattern scripts/build-index.mjs
// uses for the same reason.
const require = createRequire(import.meta.url);
const { VoyageAIClient } = require("voyageai") as typeof import("voyageai");
type VoyageAIClient = InstanceType<typeof VoyageAIClient>;

export type Framework = "cdp" | "brsr";

export type { SearchOptions } from "./rag/core.ts";

const INDEX_DIR = (framework: Framework) => join(process.cwd(), "data", "rag", framework);

// Framework chunks carry section metadata on top of the generic RagChunk shape.
export interface Chunk extends RagChunk {
  sectionNumber: string;
  sectionTitle: string;
  sectionPath: string[];
}

interface VectorsFile {
  model: string;
  vectors: number[][];
  bm25: Bm25Index;
}

interface LoadedIndex {
  chunks: Chunk[];
  vectors: number[][];
  bm25: Bm25Index;
}

const indexCache = new Map<Framework, LoadedIndex>();
let voyageClient: VoyageAIClient | null = null;

/** Lazily construct the shared Voyage client (also used by userIndex.ts). */
export function getVoyage(): VoyageAIClient {
  if (voyageClient) return voyageClient;
  if (!process.env.VOYAGE_API_KEY) {
    throw new Error("VOYAGE_API_KEY is not set");
  }
  voyageClient = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
  return voyageClient;
}

function loadIndex(framework: Framework): LoadedIndex {
  const cached = indexCache.get(framework);
  if (cached) return cached;
  const dir = INDEX_DIR(framework);
  const chunks = JSON.parse(readFileSync(join(dir, "chunks.json"), "utf8")) as Chunk[];
  const vectorsFile = JSON.parse(readFileSync(join(dir, "vectors.json"), "utf8")) as VectorsFile;
  const loaded: LoadedIndex = {
    chunks,
    vectors: vectorsFile.vectors,
    bm25: vectorsFile.bm25,
  };
  indexCache.set(framework, loaded);
  return loaded;
}

/** Embed a search query with Voyage (inputType "query"). Shared with userIndex. */
export async function embedQuery(voyage: VoyageAIClient, query: string): Promise<number[]> {
  const resp = await voyage.embed({
    input: sanitizeQuery(query),
    model: "voyage-3-large",
    inputType: "query",
  });
  const vec = resp.data?.[0]?.embedding;
  if (!vec) throw new Error("Voyage returned no embedding for query");
  return vec;
}

// Framework search hits expose the section metadata too (Chunk extends RagChunk,
// fuseSearch spreads the chunk through).
export interface RetrievedChunk extends CoreRetrievedChunk, Chunk {}

export async function search(
  query: string,
  framework: Framework,
  options: SearchOptions = {}
): Promise<RetrievedChunk[]> {
  const { chunks, vectors, bm25 } = loadIndex(framework);
  const voyage = getVoyage();

  const [queryVec, queryTokens] = await Promise.all([
    embedQuery(voyage, query),
    Promise.resolve(tokenize(query)),
  ]);

  return fuseSearch<Chunk>({ chunks, vectors, bm25 }, queryVec, queryTokens, options) as RetrievedChunk[];
}

// Test/eval helper — exposes the raw chunk count without forcing an embed call.
export function indexStats(framework: Framework): { chunkCount: number; embedDim: number } {
  const idx = loadIndex(framework);
  return {
    chunkCount: idx.chunks.length,
    embedDim: idx.vectors[0]?.length ?? 0,
  };
}
