// One-time indexing pipeline for the CBAM guidance PDF.
//
// Reads the PDF, splits it into leaf-section chunks (respecting numbered
// headings like 1, 1.1, 1.1.1...), runs Anthropic Contextual Retrieval to
// generate per-chunk context blurbs (prompt-cached on the document), embeds
// each (context + body) with Voyage AI, and writes a single index file the
// runtime route loads on cold start.
//
// Usage:
//   node scripts/build-index.mjs            # incremental — skips if index exists
//   node scripts/build-index.mjs --force    # rebuild from scratch
//   node scripts/build-index.mjs --dry-run  # parse + chunk only, no API calls

import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"] });
import { createRequire } from "node:module";
import Anthropic from "@anthropic-ai/sdk";
import { PDFParse } from "pdf-parse";

// Voyage's ESM build has a broken directory import; use the CJS entry.
const require = createRequire(import.meta.url);
const { VoyageAIClient } = require("voyageai");
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const PDF_PATH = resolve(
  PROJECT_ROOT,
  "..",
  "CBAM rsources",
  "Guidance document on CBAM implementation for installation operators outside the EU.pdf"
);
const INDEX_DIR = join(PROJECT_ROOT, "data", "rag");
const CHUNKS_PATH = join(INDEX_DIR, "chunks.json");
const VECTORS_PATH = join(INDEX_DIR, "vectors.json");
const META_PATH = join(INDEX_DIR, "meta.json");
const CONTEXTUALIZED_CHECKPOINT = join(INDEX_DIR, ".contextualized.json");

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const DRY_RUN = args.has("--dry-run");

// Tunables
const FIRST_BODY_PAGE = 7; // The PDF's "1 SUMMARY" starts here; 1-6 are cover + TOC.
const MAX_CHUNK_CHARS = 4000; // Roughly ~1000 tokens.
const CHUNK_OVERLAP_CHARS = 400;
const EMBED_MODEL = "voyage-3-large";
const CONTEXTUALIZER_MODEL = "claude-haiku-4-5";
const EMBED_BATCH_SIZE = 32; // Voyage allows up to 128, but smaller batches keep payload sizes safe.

// ---------- Step 1: Parse PDF ----------

async function parsePdf() {
  console.log(`Reading ${PDF_PATH}...`);
  const buf = await readFile(PDF_PATH);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText({ pageJoiner: "" });
  await parser.destroy();
  console.log(`Parsed ${result.total} pages (${result.text.length} chars).`);
  return result.pages.filter((p) => p.num >= FIRST_BODY_PAGE);
}

// ---------- Text sanitization ----------

// PDFs commonly emit soft hyphens, null bytes, lone surrogates, and other
// codepoints that survive UTF-16 in JS but blow up downstream APIs that
// require strict UTF-8. Voyage's embedding API rejects these with a 400.
function sanitizeText(s) {
  // 1. NFC normalize so decomposed accents collapse and ligatures are stable.
  let out = s.normalize("NFC");
  // 2. Replace lone surrogates with U+FFFD. JS strings can hold these but
  //    they don't encode to valid UTF-8.
  out = out.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�");
  // 3. Strip null bytes and most C0 controls (keep tab/newline/CR).
  out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // 4. Strip soft hyphen (U+00AD), zero-width chars (U+200B-U+200D), BOMs (U+FEFF).
  out = out.replace(/[­​‌‍﻿]/g, "");
  // 5. Normalize all Unicode space separators to ASCII space, then collapse
  //    runs of whitespace while preserving paragraph breaks.
  out = out.replace(/\p{Zs}/gu, " ");
  out = out.replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n");
  return out.trim();
}

// ---------- Step 2: Section-aware chunking ----------

// A heading line in the body looks like "1 SUMMARY" or "4.3.2 What needs to be monitored..."
// followed by a tab or whitespace. The TOC is already excluded by skipping pages 1-6.
const HEADING_RE = /^(\d+(?:\.\d+){0,4})\s+(.+?)\s*$/;

// Heuristic: a line matching the regex is a heading only if it's reasonably short
// (titles aren't sentences) and the title isn't all-lowercase prose.
function looksLikeHeading(line) {
  const m = line.match(HEADING_RE);
  if (!m) return null;
  const [, number, title] = m;
  // Reject 4-digit leading numbers (years like 2023, 2024) and other non-section prefixes.
  // Real section numbers max out around 9 at top level for this doc; cap top component at 50.
  const parts = number.split(".").map(Number);
  if (parts[0] > 50) return null;
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (title.length > 110) return null;
  // Reject lines that are clearly continuation prose (have lots of stop punctuation).
  if (/[.][\s].+[.][\s]/.test(title)) return null;
  // Reject "1 October 2023" type date noise.
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(title)) return null;
  // Top-level headings (single component, e.g. "1 SUMMARY") in this doc are
  // ALL CAPS; reject single-digit "headings" that aren't, since they're
  // almost always footnote markers.
  if (parts.length === 1) {
    const lettersOnly = title.replace(/[^A-Za-z]/g, "");
    if (lettersOnly && lettersOnly !== lettersOnly.toUpperCase()) return null;
  }
  return { number, title: title.trim() };
}

function chunkBySection(pages) {
  // Walk every line, splitting on detected headings. Each section accumulates
  // lines until the next heading. Track page span for citations.
  const sections = [];
  let current = null;

  for (const page of pages) {
    const lines = page.text.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.replace(/\t/g, " ").trim();
      if (!line) continue;
      const heading = looksLikeHeading(line);
      if (heading) {
        // Close previous section
        if (current) sections.push(current);
        current = {
          number: heading.number,
          title: heading.title,
          firstPage: page.num,
          lastPage: page.num,
          body: [],
        };
        continue;
      }
      if (!current) {
        // Pre-section content (rare — body starts with "1 SUMMARY"). Skip.
        continue;
      }
      current.body.push(line);
      current.lastPage = page.num;
    }
  }
  if (current) sections.push(current);
  return sections;
}

// Keep only leaf sections — sections whose number is NOT a strict prefix of
// some other section's number. E.g. "5.6" is not a leaf if "5.6.1" exists.
function keepLeafSections(sections) {
  const numbers = new Set(sections.map((s) => s.number));
  return sections.filter((s) => {
    for (const other of numbers) {
      if (other !== s.number && other.startsWith(s.number + ".")) return false;
    }
    return true;
  });
}

// Split a section's body into chunks of ~MAX_CHUNK_CHARS with overlap.
function splitSection(section, sectionPath) {
  const text = sanitizeText(section.body.join("\n"));
  if (!text) return [];

  if (text.length <= MAX_CHUNK_CHARS) {
    return [
      {
        sectionNumber: section.number,
        sectionTitle: section.title,
        sectionPath,
        firstPage: section.firstPage,
        lastPage: section.lastPage,
        chunkIndex: 0,
        text,
      },
    ];
  }

  // Chunk on paragraph boundaries when possible.
  const paragraphs = text.split(/\n{2,}|\n(?=\s*[•\-])/g);
  const chunks = [];
  let buf = "";
  let chunkIdx = 0;
  for (const p of paragraphs) {
    const next = buf ? `${buf}\n\n${p}` : p;
    if (next.length > MAX_CHUNK_CHARS && buf) {
      chunks.push({
        sectionNumber: section.number,
        sectionTitle: section.title,
        sectionPath,
        firstPage: section.firstPage,
        lastPage: section.lastPage,
        chunkIndex: chunkIdx++,
        text: buf,
      });
      // Tail of previous chunk → start of next, for overlap continuity.
      const tail = buf.slice(Math.max(0, buf.length - CHUNK_OVERLAP_CHARS));
      buf = `${tail}\n\n${p}`;
    } else {
      buf = next;
    }
  }
  if (buf.trim()) {
    chunks.push({
      sectionNumber: section.number,
      sectionTitle: section.title,
      sectionPath,
      firstPage: section.firstPage,
      lastPage: section.lastPage,
      chunkIndex: chunkIdx,
      text: buf,
    });
  }
  return chunks;
}

// Build sectionPath like ["6 Monitoring and Reporting Obligations", "6.4 Planning your monitoring", "6.4.3 Written procedures"]
// for each leaf, walking up the number hierarchy.
function buildSectionPaths(allSections) {
  const byNumber = new Map(allSections.map((s) => [s.number, s]));
  return (leaf) => {
    const parts = leaf.number.split(".");
    const path = [];
    for (let i = 1; i <= parts.length; i++) {
      const num = parts.slice(0, i).join(".");
      const s = byNumber.get(num);
      if (s) path.push(`${s.number} ${s.title}`);
    }
    return path;
  };
}

// ---------- Step 3: Contextual Retrieval (Anthropic) ----------

const CONTEXTUALIZER_PROMPT = `Here is a chunk we want to situate within the whole document:

<chunk>
{chunk}
</chunk>

Please give a short, succinct context (1-3 sentences) to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Mention the section number and title, what topic it covers, and any key terms or concepts in the chunk that someone might search for. Answer only with the succinct context and nothing else.`;

async function generateContexts(client, fullDocText, chunks) {
  // Anthropic's Contextual Retrieval pattern: cache the full document once,
  // then make one cheap call per chunk. The cache hit means each call only
  // pays for the chunk + response.
  console.log(`Generating context blurbs for ${chunks.length} chunks (cached doc + per-chunk Haiku call)...`);
  const out = [];
  let i = 0;
  for (const chunk of chunks) {
    i++;
    const prompt = CONTEXTUALIZER_PROMPT.replace("{chunk}", chunk.text);
    try {
      const resp = await client.messages.create({
        model: CONTEXTUALIZER_MODEL,
        max_tokens: 200,
        system: [
          {
            type: "text",
            text: `<document>\n${fullDocText}\n</document>`,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: prompt }],
      });
      const text = resp.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      out.push({ ...chunk, context: text });
      if (i % 25 === 0 || i === chunks.length) {
        const usage = resp.usage;
        console.log(
          `  [${i}/${chunks.length}] §${chunk.sectionNumber} | cache_read=${usage.cache_read_input_tokens ?? 0} cache_create=${usage.cache_creation_input_tokens ?? 0}`
        );
      }
    } catch (err) {
      console.error(`  Failed for §${chunk.sectionNumber} chunk ${chunk.chunkIndex}:`, err.message);
      out.push({ ...chunk, context: "" });
    }
  }
  return out;
}

// ---------- Step 4: Embed via Voyage ----------

async function embedOne(voyage, input) {
  const resp = await voyage.embed({ input, model: EMBED_MODEL, inputType: "document" });
  const vec = resp.data?.[0]?.embedding;
  if (!vec) throw new Error("Voyage returned no embedding");
  return vec;
}

async function embedAll(voyage, chunks) {
  console.log(`Embedding ${chunks.length} chunks via ${EMBED_MODEL}...`);
  const vectors = new Array(chunks.length);
  // Sanitize defensively — context blurbs from the LLM may still contain
  // codepoints Voyage rejects.
  const inputs = chunks.map((c) => sanitizeText(`${c.context}\n\n${c.text}`));
  for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
    const batchInputs = inputs.slice(start, start + EMBED_BATCH_SIZE);
    try {
      const resp = await voyage.embed({
        input: batchInputs,
        model: EMBED_MODEL,
        inputType: "document",
      });
      if (!resp.data) throw new Error("Voyage returned no data");
      for (const item of resp.data) {
        if (typeof item.index !== "number" || !item.embedding) continue;
        vectors[start + item.index] = item.embedding;
      }
    } catch (err) {
      // Batch failed — fall back to per-item so one bad chunk doesn't poison
      // the whole batch. Surface which chunk(s) actually fail.
      const status = err?.statusCode ?? err?.status;
      console.warn(`  batch starting at ${start} failed (status=${status}). Retrying per-item.`);
      for (let i = 0; i < batchInputs.length; i++) {
        const globalIdx = start + i;
        const c = chunks[globalIdx];
        try {
          vectors[globalIdx] = await embedOne(voyage, batchInputs[i]);
        } catch (innerErr) {
          console.error(
            `    chunk #${globalIdx} (§${c.sectionNumber} chunk ${c.chunkIndex}) FAILED: ${innerErr.message}`
          );
          // Last-resort fallback: strip to ASCII and try once more.
          const ascii = batchInputs[i].replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
          try {
            vectors[globalIdx] = await embedOne(voyage, ascii);
            console.error(`    chunk #${globalIdx} recovered with ASCII fallback`);
          } catch (asciiErr) {
            console.error(`    chunk #${globalIdx} ASCII fallback also failed: ${asciiErr.message}`);
            throw innerErr;
          }
        }
      }
    }
    console.log(`  embedded ${Math.min(start + EMBED_BATCH_SIZE, chunks.length)}/${chunks.length}`);
  }
  return vectors;
}

// ---------- Step 5: BM25 index ----------

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9§\.\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set(
  "a an and are as at be by for from has have he in is it its of on or that the to was were will with this these those which there their them they we you your".split(
    " "
  )
);

function buildBm25Index(chunks) {
  // Standard BM25: per-doc token frequencies + IDF table.
  const docs = chunks.map((c, id) => {
    const tokens = tokenize(`${c.context} ${c.text}`);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { id, tf, length: tokens.length };
  });
  const N = docs.length;
  const df = new Map();
  for (const d of docs) {
    for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = {};
  for (const [term, freq] of df) {
    idf[term] = Math.log(1 + (N - freq + 0.5) / (freq + 0.5));
  }
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / Math.max(1, N);
  return {
    avgLen,
    idf,
    docs: docs.map((d) => ({
      id: d.id,
      length: d.length,
      tf: Object.fromEntries(d.tf),
    })),
  };
}

// ---------- Main ----------

async function main() {
  if (!DRY_RUN && !process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Add it to .env.local.");
    process.exit(1);
  }
  if (!DRY_RUN && !process.env.VOYAGE_API_KEY) {
    console.error("VOYAGE_API_KEY is not set. Add it to .env.local.");
    process.exit(1);
  }
  if (!existsSync(PDF_PATH)) {
    console.error(`PDF not found at: ${PDF_PATH}`);
    process.exit(1);
  }
  if (!FORCE && existsSync(VECTORS_PATH) && existsSync(CHUNKS_PATH)) {
    console.log("Index already exists. Pass --force to rebuild.");
    return;
  }

  await mkdir(INDEX_DIR, { recursive: true });

  const pages = await parsePdf();
  const fullDocText = sanitizeText(
    pages.map((p) => `[Page ${p.num}]\n${p.text}`).join("\n\n")
  );

  const sections = chunkBySection(pages);
  console.log(`Detected ${sections.length} numbered sections.`);
  const leaves = keepLeafSections(sections);
  console.log(`${leaves.length} are leaf sections (no deeper subsections).`);

  const sectionPathFor = buildSectionPaths(sections);
  let chunks = [];
  for (const leaf of leaves) {
    const path = sectionPathFor(leaf);
    chunks = chunks.concat(splitSection(leaf, path));
  }
  console.log(`Produced ${chunks.length} chunks (post-split).`);

  if (DRY_RUN) {
    console.log("Dry run — sample chunks:");
    for (const c of chunks.slice(0, 5)) {
      console.log(`\n§${c.sectionNumber} ${c.sectionTitle} (p${c.firstPage}-${c.lastPage}) [${c.text.length} chars]`);
      console.log(c.text.slice(0, 300) + (c.text.length > 300 ? "..." : ""));
    }
    return;
  }

  const anthropic = new Anthropic();
  const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

  // Reuse a previous contextualization if present — context generation is the
  // expensive step (~$0.50, 3-5 min). The embed step is cheap and fast, so
  // if it fails we don't want to redo contextualization on the retry.
  let contextualized;
  if (!FORCE && existsSync(CONTEXTUALIZED_CHECKPOINT)) {
    console.log(`Loading cached contextualized chunks from ${CONTEXTUALIZED_CHECKPOINT}`);
    contextualized = JSON.parse(await readFile(CONTEXTUALIZED_CHECKPOINT, "utf8"));
    if (contextualized.length !== chunks.length) {
      console.warn(`  checkpoint has ${contextualized.length} chunks but parser produced ${chunks.length}; ignoring checkpoint.`);
      contextualized = null;
    }
  }
  if (!contextualized) {
    contextualized = await generateContexts(anthropic, fullDocText, chunks);
    await writeFile(CONTEXTUALIZED_CHECKPOINT, JSON.stringify(contextualized));
    console.log(`Checkpointed contextualized chunks to ${CONTEXTUALIZED_CHECKPOINT}`);
  }

  const vectors = await embedAll(voyage, contextualized);

  // Validate every chunk got a vector.
  const missing = vectors.findIndex((v) => !v);
  if (missing !== -1) throw new Error(`Missing vector for chunk index ${missing}`);

  const bm25 = buildBm25Index(contextualized);

  await writeFile(CHUNKS_PATH, JSON.stringify(contextualized));
  await writeFile(VECTORS_PATH, JSON.stringify({ model: EMBED_MODEL, vectors, bm25 }));
  await writeFile(
    META_PATH,
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        embedModel: EMBED_MODEL,
        contextualizerModel: CONTEXTUALIZER_MODEL,
        chunkCount: contextualized.length,
        leafSectionCount: leaves.length,
        pageCount: pages.length,
      },
      null,
      2
    )
  );

  console.log(`\nIndex written to ${INDEX_DIR}`);
  console.log(`  chunks:  ${CHUNKS_PATH} (${contextualized.length})`);
  console.log(`  vectors: ${VECTORS_PATH}`);
  console.log(`  meta:    ${META_PATH}`);
}

main().catch((err) => {
  console.error("Indexing failed:");
  console.error(err);
  process.exit(1);
});
