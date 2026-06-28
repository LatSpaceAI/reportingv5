// Shared RAG primitives — the single canonical home for the text sanitizers,
// tokenizer, BM25 scoring, dense cosine, Reciprocal Rank Fusion, the Voyage
// batch-embed loop, and the fuse-and-rank search core.
//
// This module lives under agent-runner/ON PURPOSE: the Vercel Sandbox tarball
// is built from agent-runner/ only (scripts/build-runner-tarball.mjs), so the
// runner can only import from here — not from src/lib. The Next.js ingest route
// (src/app/api/ingest/route.ts) imports this module cross-repo (Next transpiles
// the runner's .ts fine). Both the prebuilt framework index (retrieval.ts) and
// the user-uploaded-PDF index (userIndex.ts) reuse fuseSearch() so cosine/BM25/
// RRF live in exactly one place.
//
// Constraints honored so this stays importable from both runtimes:
//   - no `fs` / `path` access
//   - no API client constructed at import time (embedDocuments takes the client)
//
// scripts/build-index.mjs keeps its own copies of these helpers (it's offline
// .mjs and importing a .ts from it is awkward); this module is canonical and
// single-sourcing that script is a follow-up.

// ---------- Types ----------

/** A retrievable chunk. Framework chunks (retrieval.ts) extend this with
 *  sectionNumber/sectionTitle/sectionPath; user-doc chunks carry docId/docName. */
export interface RagChunk {
  text: string;
  context: string;
  firstPage: number;
  lastPage: number;
  chunkIndex: number;
  docId?: string;
  docName?: string;
}

export interface Bm25Doc {
  id: number;
  length: number;
  tf: Record<string, number>;
}

export interface Bm25Index {
  avgLen: number;
  idf: Record<string, number>;
  docs: Bm25Doc[];
}

/** The minimal index shape fuseSearch() ranks over. */
export interface SearchableIndex<C extends RagChunk = RagChunk> {
  chunks: C[];
  vectors: number[][];
  bm25: Bm25Index;
}

export interface RetrievedChunk extends RagChunk {
  chunkId: number;
  fusedScore: number;
  denseRank?: number;
  sparseRank?: number;
}

export interface SearchOptions {
  k?: number; // final result count
  candidatesPerRetriever?: number; // top-N from each retriever before fusion
}

// ---------- Text sanitization ----------

// PDFs and LLM output commonly emit soft hyphens, null bytes, lone surrogates,
// and other codepoints that survive UTF-16 in JS but blow up downstream APIs
// that require strict UTF-8 (Voyage rejects these with a 400). Mirrors the
// sanitizer historically duplicated in build-index.mjs + retrieval.ts.
export function sanitizeText(s: string): string {
  let out = s.normalize("NFC");
  // Replace lone surrogates with U+FFFD.
  out = out.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�");
  // Strip null bytes and most C0 controls (keep tab/newline/CR).
  out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Strip soft hyphen (U+00AD), zero-width chars (U+200B-U+200D), BOM (U+FEFF).
  out = out.replace(/[­​‌‍﻿]/g, "");
  // Normalize all Unicode space separators to ASCII space, collapse runs while
  // preserving paragraph breaks.
  out = out.replace(/\p{Zs}/gu, " ");
  out = out.replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n");
  return out.trim();
}

/** Query-time sanitizer (no paragraph-preserving collapse needed). */
export function sanitizeQuery(s: string): string {
  let out = s.normalize("NFC");
  out = out.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�");
  out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  out = out.replace(/\p{Zs}/gu, " ");
  return out.trim();
}

// ---------- Tokenization / BM25 ----------

export const STOP_WORDS = new Set(
  "a an and are as at be by for from has have he in is it its of on or that the to was were will with this these those which there their them they we you your".split(
    " "
  )
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9§\.\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// BM25 scoring (Okapi). k1=1.5, b=0.75 are textbook defaults.
export function bm25Score(
  query: string[],
  doc: Bm25Doc,
  idf: Record<string, number>,
  avgLen: number
): number {
  const k1 = 1.5;
  const b = 0.75;
  let score = 0;
  for (const term of query) {
    const tf = doc.tf[term] ?? 0;
    if (tf === 0) continue;
    const termIdf = idf[term] ?? 0;
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (doc.length / avgLen));
    score += termIdf * (numerator / denominator);
  }
  return score;
}

/** Build a BM25 index from documents' searchable text (context + body). */
export function buildBm25Index(docs: Array<{ context?: string; text: string }>): Bm25Index {
  const built = docs.map((c, id) => {
    const tokens = tokenize(`${c.context ?? ""} ${c.text}`);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { id, tf, length: tokens.length };
  });
  const N = built.length;
  const df = new Map<string, number>();
  for (const d of built) {
    for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf: Record<string, number> = {};
  for (const [term, freq] of df) {
    idf[term] = Math.log(1 + (N - freq + 0.5) / (freq + 0.5));
  }
  const avgLen = built.reduce((s, d) => s + d.length, 0) / Math.max(1, N);
  return {
    avgLen,
    idf,
    docs: built.map((d) => ({ id: d.id, length: d.length, tf: Object.fromEntries(d.tf) })),
  };
}

// ---------- Dense similarity / fusion ----------

// Cosine similarity. Voyage returns L2-normalized vectors so this reduces to a
// dot product, but we normalize defensively in case that changes.
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

interface RankedHit {
  chunkId: number;
  rank: number;
  score: number;
}

export function rrf(rankings: RankedHit[][], k = 60): Map<number, number> {
  // Reciprocal Rank Fusion: score(d) = Σ 1 / (k + rank_i(d))
  const merged = new Map<number, number>();
  for (const ranked of rankings) {
    for (const hit of ranked) {
      const cur = merged.get(hit.chunkId) ?? 0;
      merged.set(hit.chunkId, cur + 1 / (k + hit.rank));
    }
  }
  return merged;
}

// ---------- Fuse-and-rank core ----------

// Hybrid search over an already-loaded index: dense cosine ranking + sparse
// BM25 ranking, fused via RRF. The caller supplies the query embedding and the
// query tokens (so this stays free of any API-client dependency). Both the
// prebuilt framework index and the user-uploaded-doc index call this.
export function fuseSearch<C extends RagChunk>(
  index: SearchableIndex<C>,
  queryVec: number[],
  queryTokens: string[],
  options: SearchOptions = {}
): (RetrievedChunk & C)[] {
  const { k = 5, candidatesPerRetriever = 20 } = options;
  const { chunks, vectors, bm25 } = index;

  // Dense ranking
  const denseScores = vectors.map((v, i) => ({ chunkId: i, score: cosine(queryVec, v) }));
  denseScores.sort((a, b) => b.score - a.score);
  const denseRanked: RankedHit[] = denseScores
    .slice(0, candidatesPerRetriever)
    .map((d, rank) => ({ chunkId: d.chunkId, rank, score: d.score }));

  // Sparse ranking
  const sparseScores = bm25.docs
    .map((d) => ({ chunkId: d.id, score: bm25Score(queryTokens, d, bm25.idf, bm25.avgLen) }))
    .filter((d) => d.score > 0);
  sparseScores.sort((a, b) => b.score - a.score);
  const sparseRanked: RankedHit[] = sparseScores
    .slice(0, candidatesPerRetriever)
    .map((d, rank) => ({ chunkId: d.chunkId, rank, score: d.score }));

  // Fuse
  const fused = rrf([denseRanked, sparseRanked]);
  const denseRankMap = new Map(denseRanked.map((h) => [h.chunkId, h.rank]));
  const sparseRankMap = new Map(sparseRanked.map((h) => [h.chunkId, h.rank]));

  const top = Array.from(fused.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k);

  return top.map(([chunkId, score]) => ({
    ...chunks[chunkId],
    chunkId,
    fusedScore: score,
    denseRank: denseRankMap.get(chunkId),
    sparseRank: sparseRankMap.get(chunkId),
  }));
}

// ---------- Voyage batch embedding (document side) ----------

// Minimal structural type for the Voyage client's embed method, so this module
// never imports the voyageai package (keeping it client-construction-free and
// importable from both runtimes).
export interface VoyageEmbedder {
  embed(args: {
    input: string | string[];
    model: string;
    inputType?: string;
  }): Promise<{ data?: Array<{ index?: number; embedding?: number[] }> }>;
}

const EMBED_BATCH_SIZE = 32; // Voyage allows 128; smaller keeps payloads safe.

async function embedOne(voyage: VoyageEmbedder, input: string, model: string): Promise<number[]> {
  const resp = await voyage.embed({ input, model, inputType: "document" });
  const vec = resp.data?.[0]?.embedding;
  if (!vec) throw new Error("Voyage returned no embedding");
  return vec;
}

// Batch-embed document inputs with the same resilience as build-index.mjs: on a
// batch failure fall back to per-item, and as a last resort strip to ASCII.
// Inputs are sanitized defensively before sending.
export async function embedDocuments(
  voyage: VoyageEmbedder,
  inputs: string[],
  model = "voyage-3-large"
): Promise<number[][]> {
  const vectors: number[][] = new Array(inputs.length);
  const clean = inputs.map((s) => sanitizeText(s));
  for (let start = 0; start < clean.length; start += EMBED_BATCH_SIZE) {
    const batch = clean.slice(start, start + EMBED_BATCH_SIZE);
    try {
      const resp = await voyage.embed({ input: batch, model, inputType: "document" });
      if (!resp.data) throw new Error("Voyage returned no data");
      for (const item of resp.data) {
        if (typeof item.index !== "number" || !item.embedding) continue;
        vectors[start + item.index] = item.embedding;
      }
      // Guard against a partial batch response leaving holes.
      for (let i = 0; i < batch.length; i++) {
        if (!vectors[start + i]) vectors[start + i] = await embedOne(voyage, batch[i], model);
      }
    } catch {
      // Batch failed — per-item so one bad chunk doesn't poison the batch.
      for (let i = 0; i < batch.length; i++) {
        const globalIdx = start + i;
        try {
          vectors[globalIdx] = await embedOne(voyage, batch[i], model);
        } catch (innerErr) {
          const ascii = batch[i].replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
          try {
            vectors[globalIdx] = await embedOne(voyage, ascii, model);
          } catch {
            throw innerErr;
          }
        }
      }
    }
  }
  return vectors;
}
