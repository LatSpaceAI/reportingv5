// Shared RAG primitives — the Next.js-side copy.
//
// The CANONICAL implementation lives in agent-runner/lib/rag/core.ts (the
// runner can only import from agent-runner/, since the Vercel Sandbox tarball is
// built from that dir). The runner's copy uses explicit `.ts` import extensions
// (required by Node's native --experimental-strip-types), which the Next
// compiler/bundler cannot consume. Rather than couple the two build systems, we
// duplicate the small set of primitives here — the same deliberate-duplication
// pattern this codebase already uses for src/lib/dispatcher/frameworks.ts vs
// agent-runner/lib/agent/frameworkMap.ts.
//
// Keep this in sync with agent-runner/lib/rag/core.ts. If they diverge it will
// be obvious (the ingest route and the runner would chunk/score differently).
// These two consumers only need: sanitizeText, tokenize/STOP_WORDS,
// buildBm25Index, embedDocuments, and the RagChunk/Bm25* types. (cosine/
// bm25Score/rrf/fuseSearch are runtime-search-only and live solely in the
// runner copy.)

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

// ---------- Text sanitization ----------

export function sanitizeText(s: string): string {
  let out = s.normalize("NFC");
  out = out.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�");
  out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  out = out.replace(/[­​‌‍﻿]/g, "");
  out = out.replace(/\p{Zs}/gu, " ");
  out = out.replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n");
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

// ---------- Voyage batch embedding (document side) ----------

export interface VoyageEmbedder {
  embed(args: {
    input: string | string[];
    model: string;
    inputType?: string;
  }): Promise<{ data?: Array<{ index?: number; embedding?: number[] }> }>;
}

const EMBED_BATCH_SIZE = 32;

async function embedOne(voyage: VoyageEmbedder, input: string, model: string): Promise<number[]> {
  const resp = await voyage.embed({ input, model, inputType: "document" });
  const vec = resp.data?.[0]?.embedding;
  if (!vec) throw new Error("Voyage returned no embedding");
  return vec;
}

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
      for (let i = 0; i < batch.length; i++) {
        if (!vectors[start + i]) vectors[start + i] = await embedOne(voyage, batch[i], model);
      }
    } catch {
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
