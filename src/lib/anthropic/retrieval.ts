// Retrieval module — loads the prebuilt RAG index (chunks + dense vectors +
// BM25) once per server process and exposes a hybrid search() that fuses
// dense + sparse results via Reciprocal Rank Fusion.
//
// The index is built offline by scripts/build-index.mjs and lives in
// data/rag/. On Vercel the data/ directory is bundled with the route via
// outputFileTracingIncludes in next.config.mjs.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VoyageAIClient } from "voyageai";

const INDEX_DIR = join(process.cwd(), "data", "rag");

export interface Chunk {
  sectionNumber: string;
  sectionTitle: string;
  sectionPath: string[];
  firstPage: number;
  lastPage: number;
  chunkIndex: number;
  text: string;
  context: string;
}

interface Bm25Doc {
  id: number;
  length: number;
  tf: Record<string, number>;
}

interface Bm25Index {
  avgLen: number;
  idf: Record<string, number>;
  docs: Bm25Doc[];
}

interface VectorsFile {
  model: string;
  vectors: number[][];
  bm25: Bm25Index;
}

let cache: {
  chunks: Chunk[];
  vectors: number[][];
  bm25: Bm25Index;
  voyage: VoyageAIClient;
} | null = null;

function loadIndex() {
  if (cache) return cache;
  const chunks = JSON.parse(readFileSync(join(INDEX_DIR, "chunks.json"), "utf8")) as Chunk[];
  const vectorsFile = JSON.parse(
    readFileSync(join(INDEX_DIR, "vectors.json"), "utf8")
  ) as VectorsFile;
  if (!process.env.VOYAGE_API_KEY) {
    throw new Error("VOYAGE_API_KEY is not set");
  }
  cache = {
    chunks,
    vectors: vectorsFile.vectors,
    bm25: vectorsFile.bm25,
    voyage: new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY }),
  };
  return cache;
}

// Cosine similarity between unit-norm-ish vectors. Voyage already returns
// L2-normalized vectors so cosine reduces to dot product, but we normalize
// defensively in case that changes.
function cosine(a: number[], b: number[]): number {
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

// BM25 scoring (Okapi). k1=1.5, b=0.75 are textbook defaults.
function bm25Score(query: string[], doc: Bm25Doc, idf: Record<string, number>, avgLen: number): number {
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

const STOP_WORDS = new Set(
  "a an and are as at be by for from has have he in is it its of on or that the to was were will with this these those which there their them they we you your".split(
    " "
  )
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9§\.\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// Defensive UTF-8 sanitizer — Voyage rejects lone surrogates and certain
// control bytes with a 400. Mirrors the sanitizer in scripts/build-index.mjs.
function sanitizeQuery(s: string): string {
  let out = s.normalize("NFC");
  out = out.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�");
  out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  out = out.replace(/\p{Zs}/gu, " ");
  return out.trim();
}

async function embedQuery(voyage: VoyageAIClient, query: string): Promise<number[]> {
  const resp = await voyage.embed({
    input: sanitizeQuery(query),
    model: "voyage-3-large",
    inputType: "query",
  });
  const vec = resp.data?.[0]?.embedding;
  if (!vec) throw new Error("Voyage returned no embedding for query");
  return vec;
}

interface RankedHit {
  chunkId: number;
  rank: number;
  score: number;
}

function rrf(rankings: RankedHit[][], k = 60): Map<number, number> {
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

export interface RetrievedChunk extends Chunk {
  chunkId: number;
  fusedScore: number;
  denseRank?: number;
  sparseRank?: number;
}

export interface SearchOptions {
  k?: number; // final result count
  candidatesPerRetriever?: number; // top-N from each retriever before fusion
}

export async function search(query: string, options: SearchOptions = {}): Promise<RetrievedChunk[]> {
  const { k = 5, candidatesPerRetriever = 20 } = options;
  const { chunks, vectors, bm25, voyage } = loadIndex();

  // Run dense + sparse in parallel.
  const [queryVec, sparseTokens] = await Promise.all([
    embedQuery(voyage, query),
    Promise.resolve(tokenize(query)),
  ]);

  // Dense ranking
  const denseScores = vectors.map((v, i) => ({ chunkId: i, score: cosine(queryVec, v) }));
  denseScores.sort((a, b) => b.score - a.score);
  const denseRanked: RankedHit[] = denseScores
    .slice(0, candidatesPerRetriever)
    .map((d, rank) => ({ chunkId: d.chunkId, rank, score: d.score }));

  // Sparse ranking
  const sparseScores = bm25.docs
    .map((d) => ({ chunkId: d.id, score: bm25Score(sparseTokens, d, bm25.idf, bm25.avgLen) }))
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

// Test/eval helper — exposes the raw chunk count without forcing an embed call.
export function indexStats(): { chunkCount: number; embedDim: number } {
  const idx = loadIndex();
  return {
    chunkCount: idx.chunks.length,
    embedDim: idx.vectors[0]?.length ?? 0,
  };
}
