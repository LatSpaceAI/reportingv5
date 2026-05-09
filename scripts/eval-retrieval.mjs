// Retrieval eval harness — runs a list of queries against the prebuilt index
// and reports recall@k, MRR (mean reciprocal rank), and which expected
// sections were missed. Edit eval-set.json to add or change queries.
//
// Usage:
//   node scripts/eval-retrieval.mjs            # uses scripts/eval-set.json
//   node scripts/eval-retrieval.mjs --k 5      # override top-k
//   node scripts/eval-retrieval.mjs --verbose  # show retrieved sections per query

import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"] });
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const EVAL_SET_PATH = join(__dirname, "eval-set.json");
const INDEX_DIR = join(PROJECT_ROOT, "agent-runner", "data", "rag");

const require = createRequire(import.meta.url);
const { VoyageAIClient } = require("voyageai");

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const kArg = args.find((a) => a.startsWith("--k="));
const k = kArg ? Number(kArg.split("=")[1]) : 5;

// ---------- Tiny inlined retrieval (mirrors agent-runner/lib/retrieval.ts) ----------
// We can't `import` the TS module from a Node script, so this re-implements
// the cosine + BM25 + RRF logic against the same JSON files. Keep in sync.

const STOP_WORDS = new Set(
  "a an and are as at be by for from has have he in is it its of on or that the to was were will with this these those which there their them they we you your".split(
    " "
  )
);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9§\.\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function bm25Score(query, doc, idf, avgLen) {
  const k1 = 1.5, b = 0.75;
  let score = 0;
  for (const term of query) {
    const tf = doc.tf[term] ?? 0;
    if (tf === 0) continue;
    const termIdf = idf[term] ?? 0;
    score += termIdf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc.length / avgLen))));
  }
  return score;
}

function rrf(rankings, k = 60) {
  const merged = new Map();
  for (const ranked of rankings) {
    for (const hit of ranked) {
      merged.set(hit.chunkId, (merged.get(hit.chunkId) ?? 0) + 1 / (k + hit.rank));
    }
  }
  return merged;
}

async function main() {
  if (!process.env.VOYAGE_API_KEY) {
    console.error("VOYAGE_API_KEY is not set in .env.local");
    process.exit(1);
  }

  const [chunks, vectorsFile, evalSet] = await Promise.all([
    readFile(join(INDEX_DIR, "chunks.json"), "utf8").then(JSON.parse),
    readFile(join(INDEX_DIR, "vectors.json"), "utf8").then(JSON.parse),
    readFile(EVAL_SET_PATH, "utf8").then(JSON.parse),
  ]);

  const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

  let recallSum = 0;
  let mrrSum = 0;
  let totalExpected = 0;
  let totalFound = 0;
  const failures = [];

  for (const item of evalSet) {
    const { query, expectedSections } = item;
    const tokens = tokenize(query);

    const queryEmbed = await voyage.embed({
      input: query,
      model: "voyage-3-large",
      inputType: "query",
    });
    const queryVec = queryEmbed.data?.[0]?.embedding;
    if (!queryVec) {
      console.error(`Embed failed for: ${query}`);
      continue;
    }

    // Dense
    const denseScores = vectorsFile.vectors
      .map((v, i) => ({ chunkId: i, score: cosine(queryVec, v) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((d, rank) => ({ chunkId: d.chunkId, rank }));

    // Sparse
    const sparseScores = vectorsFile.bm25.docs
      .map((d) => ({
        chunkId: d.id,
        score: bm25Score(tokens, d, vectorsFile.bm25.idf, vectorsFile.bm25.avgLen),
      }))
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((d, rank) => ({ chunkId: d.chunkId, rank }));

    const fused = rrf([denseScores, sparseScores]);
    const top = Array.from(fused.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([chunkId]) => chunks[chunkId]);

    // Prefix-match: an expected section is satisfied if any retrieved chunk's
    // section number equals it OR is a deeper subsection (e.g. expecting "7.1"
    // is satisfied by retrieving §7.1.3). Hierarchical docs only have leaf
    // sections in the index, so strict equality undercounts real recall.
    const retrievedSections = top.map((c) => c.sectionNumber);
    const expected = expectedSections;
    const matches = (expectedNum, retrievedNum) =>
      retrievedNum === expectedNum || retrievedNum.startsWith(expectedNum + ".");
    const hits = expected.filter((e) => retrievedSections.some((r) => matches(e, r)));
    const recall = hits.length / expected.length;
    recallSum += recall;
    totalExpected += expected.length;
    totalFound += hits.length;

    // MRR — rank of the first chunk that matches any expected section.
    let firstHitRank = 0;
    for (let i = 0; i < top.length; i++) {
      if (expected.some((e) => matches(e, top[i].sectionNumber))) {
        firstHitRank = i + 1;
        break;
      }
    }
    mrrSum += firstHitRank > 0 ? 1 / firstHitRank : 0;

    const status = recall === 1 ? "PASS" : recall === 0 ? "FAIL" : "PART";
    console.log(`[${status}] recall=${recall.toFixed(2)}  ${query}`);
    if (verbose || recall < 1) {
      console.log(`  expected: ${[...expected].join(", ")}`);
      console.log(`  retrieved: ${top.map((c) => `§${c.sectionNumber}`).join(", ")}`);
    }
    if (recall < 1) {
      // For a failed query, scan further down the fused list to see if the
      // expected section is present below k — that's the kind of miss a
      // reranker would fix.
      const allFused = Array.from(fused.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([chunkId]) => chunks[chunkId].sectionNumber);
      const positions = expected
        .map((e) => {
          const idx = allFused.findIndex((s) => s === e || s.startsWith(e + "."));
          return idx === -1 ? null : { section: e, rank: idx + 1 };
        })
        .filter(Boolean);
      console.log(`  rank in full fused list: ${JSON.stringify(positions)}`);
      failures.push({
        query,
        expected: [...expected],
        retrieved: top.map((c) => c.sectionNumber),
        ranksInFusedList: positions,
      });
    }
  }

  const N = evalSet.length;
  console.log("\n====== Summary ======");
  console.log(`Queries: ${N}`);
  console.log(`Mean recall@${k}: ${(recallSum / N).toFixed(3)}`);
  console.log(`MRR@${k}:         ${(mrrSum / N).toFixed(3)}`);
  console.log(`Sections found / expected: ${totalFound} / ${totalExpected}`);
  console.log(`Failures: ${failures.length} of ${N}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
