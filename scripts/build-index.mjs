// One-time indexing pipeline for a guidance PDF (CBAM, CDP, ...).
//
// Reads the PDF, splits it into leaf-section chunks (respecting numbered
// headings like 1, 1.1, 1.1.1...), runs Anthropic Contextual Retrieval to
// generate per-chunk context blurbs (prompt-cached on the document), embeds
// each (context + body) with Voyage AI, and writes the index files the
// runtime route loads on cold start.
//
// Usage:
//   node scripts/build-index.mjs                                 # CBAM (default), incremental
//   node scripts/build-index.mjs --framework cdp --pdf "./CDP resources/CDP 2026 questionnaire guidance.pdf"
//   node scripts/build-index.mjs --force                         # rebuild from scratch
//   node scripts/build-index.mjs --dry-run                       # parse + chunk only, no API calls
//   node scripts/build-index.mjs --first-page 5                  # override skipped front-matter pages

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

// ---------- CLI args ----------

const argv = process.argv.slice(2);
const flagSet = new Set(argv);
function flagValue(name) {
  const i = argv.indexOf(name);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

const FRAMEWORK = (flagValue("--framework") ?? "cbam").toLowerCase();
const FORCE = flagSet.has("--force");
const DRY_RUN = flagSet.has("--dry-run");
const SKIP_CONTEXTUAL_FLAG = flagSet.has("--skip-contextual");
const FIRST_BODY_PAGE_OVERRIDE = flagValue("--first-page");

// Per-framework defaults. `pdfPath` is resolved relative to PROJECT_ROOT and
// can be overridden with --pdf. `firstBodyPage` skips front-matter (cover +
// TOC) so heading detection isn't confused by table-of-contents lines.
// `skipContextual` disables the Anthropic Contextual Retrieval pass — used
// for documents large enough that caching the whole PDF in Haiku's system
// prompt blows past the input-tokens-per-minute rate limit (cache_read
// tokens still count). With it disabled, chunks are embedded with
// sectionPath + title + text only.
const FRAMEWORK_DEFAULTS = {
  cbam: {
    pdfPath: "../CBAM rsources/Guidance document on CBAM implementation for installation operators outside the EU.pdf",
    firstBodyPage: 7,
    skipContextual: false,
    headingMode: "inline",
  },
  cdp: {
    pdfPath: "./CDP resources/CDP 2026 questionnaire guidance.pdf",
    firstBodyPage: 1,
    skipContextual: true,
    headingMode: "standalone",
  },
  brsr: {
    pdfPath: "./BRSR-guidelines.pdf",
    firstBodyPage: 1,
    skipContextual: false,
    headingMode: "brsr-table",
  },
};

const fwDefaults = FRAMEWORK_DEFAULTS[FRAMEWORK];
if (!fwDefaults) {
  console.error(`Unknown framework "${FRAMEWORK}". Known: ${Object.keys(FRAMEWORK_DEFAULTS).join(", ")}`);
  process.exit(1);
}

const PDF_PATH = resolve(PROJECT_ROOT, flagValue("--pdf") ?? fwDefaults.pdfPath);
const INDEX_DIR = join(PROJECT_ROOT, "data", "rag", FRAMEWORK);
const SKIP_CONTEXTUAL = SKIP_CONTEXTUAL_FLAG || fwDefaults.skipContextual === true;
const HEADING_MODE = fwDefaults.headingMode ?? "inline";
const CHUNKS_PATH = join(INDEX_DIR, "chunks.json");
const VECTORS_PATH = join(INDEX_DIR, "vectors.json");
const META_PATH = join(INDEX_DIR, "meta.json");
const CONTEXTUALIZED_CHECKPOINT = join(INDEX_DIR, ".contextualized.json");

// Tunables
const FIRST_BODY_PAGE = FIRST_BODY_PAGE_OVERRIDE ? Number(FIRST_BODY_PAGE_OVERRIDE) : fwDefaults.firstBodyPage;
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

// CBAM-style: heading number + title on the same line, e.g. "1 SUMMARY" or
// "4.3.2 What needs to be monitored...". The TOC is excluded by FIRST_BODY_PAGE.
const HEADING_RE = /^(\d+(?:\.\d+){0,4})\s+(.+?)\s*$/;

// CDP-style: question code on its own line ("1.1", "7.73.1a"), then the
// question text on the next line. The optional trailing letter handles
// "1.4a", "C2.2a" style variants.
const STANDALONE_CODE_RE = /^(\d+(?:\.\d+){0,4}[a-z]?)\s*$/i;

// Heuristic for the same-line CBAM format: a line matching the regex is a
// heading only if it's reasonably short (titles aren't sentences) and the
// title isn't all-lowercase prose.
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

// CDP variant: detect "1.1\nQuestion text..." pairs. The code sits on its
// own line; the next non-empty line is the question. We also accept a
// trailing "*(mandatory)" decoration on the code line, which CDP uses to
// flag mandatory questions ("1.1 *(mandatory)").
function looksLikeCdpHeading(line, nextLine) {
  // Strip the *(mandatory) / *(mandatory columns) decorations so they
  // don't disqualify an otherwise-valid code line.
  const stripped = line.replace(/\s*\*\(mandatory[^)]*\)\s*$/i, "").trim();
  const m = stripped.match(STANDALONE_CODE_RE);
  if (!m) return null;
  const number = m[1];
  const parts = number.split(".").map((s) => parseInt(s, 10));
  // CDP modules go from 1 to ~30; reject 4-digit years and out-of-range values.
  if (parts[0] < 1 || parts[0] > 30) return null;
  if (parts.some((n) => Number.isNaN(n))) return null;
  // The next line must look like a question/title — non-empty, reasonably
  // short for a single line, and not just punctuation or a tag dump.
  if (!nextLine) return null;
  const title = nextLine.trim();
  if (!title || title.length < 4 || title.length > 300) return null;
  // Reject lines that are obviously not titles (currency codes, country
  // names dump, comma-separated tag lines).
  if (/^[A-Z]{3}$/.test(title)) return null;
  return { number, title };
}

function chunkBySection(pages, headingMode = "inline") {
  // Walk every line, splitting on detected headings. Each section accumulates
  // lines until the next heading. Track page span for citations.
  // headingMode: "inline" (CBAM — number + title on same line) or "standalone"
  // (CDP — number on its own line, title on the next line).
  const sections = [];
  let current = null;

  for (const page of pages) {
    const lines = page.text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\t/g, " ").trim();
      if (!line) continue;

      let heading = null;
      let consumeNext = false;
      if (headingMode === "standalone") {
        // Find the next non-empty line as the candidate title.
        let nextIdx = i + 1;
        while (nextIdx < lines.length && !lines[nextIdx].trim()) nextIdx++;
        const nextLine = nextIdx < lines.length ? lines[nextIdx].replace(/\t/g, " ").trim() : "";
        heading = looksLikeCdpHeading(line, nextLine);
        if (heading) consumeNext = true;
      } else {
        heading = looksLikeHeading(line);
      }

      if (heading) {
        if (current) sections.push(current);
        current = {
          number: heading.number,
          title: heading.title,
          firstPage: page.num,
          lastPage: page.num,
          body: [],
        };
        if (consumeNext) {
          // Skip past the title line so it isn't repeated as body text.
          let nextIdx = i + 1;
          while (nextIdx < lines.length && !lines[nextIdx].trim()) nextIdx++;
          i = nextIdx;
        }
        continue;
      }
      if (!current) {
        // Pre-section content (front matter). Skip.
        continue;
      }
      current.body.push(line);
      current.lastPage = page.num;
    }
  }
  if (current) sections.push(current);
  return sections;
}

// BRSR-style: a guidance note structured as nested tables. The hierarchy is
// established by textual headings (SECTION A/B/C, PRINCIPLE 1-9, Essential /
// Leadership Indicators) rather than numbered headings, and the chunk unit
// is a single Q.No. row of the inner table.
//
// Synthesized "section number" used as the citation key:
//   Section A/B → A.Q14, B.Q5
//   Section C   → C.P3.E.Q5  (Essential), C.P7.L.Q1 (Leadership)
const BRSR_SECTION_RE = /^(?:I{1,4}|VI{0,3}|V|IV|IX)\.\s*SECTION\s+([A-C])\s*:/i;
const BRSR_PRINCIPLE_RE = /^PRINCIPLE\s+(\d+)\b/i;
const BRSR_INDICATOR_RE = /^(Essential|Leadership)\s+Indicators?\s*$/i;
const BRSR_PAGE_HEADER_RE = /^Page\s+\d+\s+of\s+\d+\s*$/i;
// Q row: a line that is purely a small integer (1-50) with optional trailing
// dot, optional comma-separated continuation ("5, 6"), optionally followed
// by the start of the field name on the same line.
const BRSR_QROW_RE = /^(\d{1,2}(?:\s*,\s*\d{1,2})*)\.?\s*(.*)$/;
// Lines we should never treat as Q rows: column-header line of the inner
// table, plain "Q. No." labels, etc.
const BRSR_TABLE_HEADER_RE = /^Q\.?\s*No\.?\s*(Field\s+Name)?/i;

function chunkBrsrTable(pages) {
  const sections = [];
  let current = null;
  let state = {
    section: null, // "A" | "B" | "C"
    principle: null, // number 1-9, only meaningful in C
    indicator: null, // "E" | "L", only meaningful in C
  };
  // Per-state-block highest Q.No. seen so far. Q.No. is monotonically
  // increasing within a (section, principle, indicator) block, so a smaller
  // number that "looks like" a Q row is almost certainly a sub-bullet inside
  // the current Q row's body.
  let lastQ = 0;
  function stateKey() {
    return `${state.section}|${state.principle ?? ""}|${state.indicator ?? ""}`;
  }
  let lastQByState = new Map();

  const sectionTitles = {
    A: "Section A: General Disclosures",
    B: "Section B: Management and Process Disclosures",
    C: "Section C: Principle Wise Performance Disclosure",
  };

  function pushCurrent() {
    if (current && current.body.length) sections.push(current);
    current = null;
  }

  function startQRow(qNumber, firstBodyLine, page) {
    pushCurrent();
    let key;
    const path = [sectionTitles[state.section]];
    if (state.section === "C") {
      key = `C.P${state.principle}.${state.indicator}.Q${qNumber}`;
      path.push(`Principle ${state.principle}`);
      path.push(state.indicator === "E" ? "Essential Indicators" : "Leadership Indicators");
    } else {
      key = `${state.section}.Q${qNumber}`;
    }
    // Title is filled in lazily from the first non-empty body line(s) — the
    // "Field Name" column. We seed body with whatever appeared on the Q.No.
    // line itself (if anything).
    current = {
      number: key,
      title: "",
      titleParts: [],
      titleLocked: false,
      firstPage: page,
      lastPage: page,
      body: [],
    };
    if (firstBodyLine) appendBodyLine(firstBodyLine, page);
  }

  function appendBodyLine(line, page) {
    if (!current) return;
    current.body.push(line);
    current.lastPage = page;
    // Heuristic for filling in the Field Name column: until we see a line
    // that looks like a numbered guidance bullet ("1.", "2.", "•") or a
    // sentence (ends in a period and is fairly long), accumulate the line
    // into the title.
    if (!current.titleLocked) {
      const isBullet = /^(\d+\.\s|[•\-]\s|\(\w\)\s)/.test(line);
      const looksLikeProse = line.length > 80 || /[.!?]$/.test(line);
      if (isBullet || looksLikeProse) {
        current.titleLocked = true;
        current.title = current.titleParts.join(" ").trim();
      } else {
        current.titleParts.push(line);
      }
    }
  }

  for (const page of pages) {
    const lines = page.text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].replace(/\t/g, " ").trim();
      if (!raw) continue;
      if (BRSR_PAGE_HEADER_RE.test(raw)) continue;

      // Section heading
      const sm = raw.match(BRSR_SECTION_RE);
      if (sm) {
        pushCurrent();
        state = { section: sm[1].toUpperCase(), principle: null, indicator: null };
        continue;
      }
      // Principle heading (only meaningful in C, but we accept anywhere)
      const pm = raw.match(BRSR_PRINCIPLE_RE);
      if (pm) {
        pushCurrent();
        state.principle = Number(pm[1]);
        state.indicator = "E"; // default to Essential until we see the heading
        continue;
      }
      // Indicator-class heading
      const im = raw.match(BRSR_INDICATOR_RE);
      if (im) {
        pushCurrent();
        state.indicator = /^E/i.test(im[1]) ? "E" : "L";
        continue;
      }
      // Track per-state lastQ for the monotonicity check below.
      lastQ = lastQByState.get(stateKey()) ?? 0;
      // Inner-table column header — skip
      if (BRSR_TABLE_HEADER_RE.test(raw)) continue;

      // Outside any section, skip (the General Guidance preamble on page 1-2
      // doesn't have Q.No. rows; treat it as front matter).
      if (!state.section) continue;

      // Q.No. row?
      // A real Q row line is essentially just a number (with optional dot,
      // optional comma-list like "5, 6"), and any text on the same line is
      // the START of the field-name column — short, no sentence-ending
      // punctuation, no trailing colon, never a complete sentence.
      // A sub-bullet "1. The entity shall..." is the same regex shape but
      // has long prose attached, so we discriminate by the tail.
      const qm = raw.match(BRSR_QROW_RE);
      if (qm && state.section) {
        const num = qm[1].split(",")[0].trim();
        const numericStart = Number(num);
        const tail = qm[2].trim();
        // A real Q row line has either an empty tail (number on its own) or
        // a SHORT noun-phrase fragment that's the start of the Field Name
        // column. Sub-bullets ("5. Apart from turnover, entities may...")
        // are typically prose: longer, ending in mid-sentence, or starting
        // with a sentence-stem word.
        const SUB_BULLET_STEMS = /^(The|A|An|Apart|Under|If|When|For|Entities?|This|These|It|Of|In|With|On|By|From|To|At|As|Such|All|Any|For|Where|While|During|Where|However|Further|Refers?|Means|Includes?|Whether)\b/;
        // Field-name tails always start with a capital letter (English title-
        // case noun phrase like "Details of...", "Sustainable sourcing", etc.)
        // — never with a digit, lowercase, or punctuation. This filters out
        // URL-fragment artifacts like "20 35669.htm" that pdf-parse emits
        // when an embedded URL wraps mid-page.
        const tailIsValidStart = tail === "" || /^[A-Z“"'(]/.test(tail);
        const tailLooksLikeProse =
          tail.length > 35 ||
          /[.!?:]$/.test(tail) ||
          SUB_BULLET_STEMS.test(tail);
        // Monotonicity: within the current state-block, Q.No. is strictly
        // increasing. A "Q3" appearing after we've already seen Q11 is a
        // sub-bullet, not a new row. The very first Q in a state-block
        // bypasses this check.
        const isMonotonic = lastQ === 0 || numericStart > lastQ;
        if (
          numericStart >= 1 &&
          numericStart <= 50 &&
          !tailLooksLikeProse &&
          tailIsValidStart &&
          isMonotonic
        ) {
          startQRow(num, tail, page.num);
          lastQByState.set(stateKey(), numericStart);
          continue;
        }
      }

      // Otherwise: body line for the current Q row.
      if (current) appendBodyLine(raw, page.num);
    }
  }
  pushCurrent();

  // Normalize: ensure title is set even if titleLocked never tripped.
  for (const s of sections) {
    if (!s.title) s.title = (s.titleParts ?? []).join(" ").trim();
    delete s.titleParts;
    delete s.titleLocked;
  }
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

// Decode a BRSR synthesized section number back into a human-readable
// breadcrumb path used for embedding context and citations.
function brsrSectionPath(row) {
  const sectionTitles = {
    A: "Section A: General Disclosures",
    B: "Section B: Management and Process Disclosures",
    C: "Section C: Principle Wise Performance Disclosure",
  };
  const parts = row.number.split(".");
  const path = [];
  if (parts[0] && sectionTitles[parts[0]]) path.push(sectionTitles[parts[0]]);
  for (const p of parts.slice(1)) {
    if (/^P\d+$/.test(p)) path.push(`Principle ${p.slice(1)}`);
    else if (p === "E") path.push("Essential Indicators");
    else if (p === "L") path.push("Leadership Indicators");
    else if (/^Q\d+$/.test(p)) {
      const t = row.title ? `${p} ${row.title}` : p;
      path.push(t);
    }
  }
  return path;
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
  if (!DRY_RUN && !SKIP_CONTEXTUAL && !process.env.ANTHROPIC_API_KEY) {
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

  console.log(`Framework: ${FRAMEWORK}`);
  console.log(`Index dir: ${INDEX_DIR}`);
  console.log(`First body page: ${FIRST_BODY_PAGE}`);
  console.log(`Heading mode: ${HEADING_MODE}`);
  console.log(`Contextual retrieval: ${SKIP_CONTEXTUAL ? "SKIPPED" : "enabled"}`);

  const pages = await parsePdf();
  const fullDocText = sanitizeText(
    pages.map((p) => `[Page ${p.num}]\n${p.text}`).join("\n\n")
  );

  let chunks = [];
  if (HEADING_MODE === "brsr-table") {
    // BRSR's hierarchy is textual (Section / Principle / Indicator-class /
    // Q.No.) and every Q row is already a leaf with its breadcrumb baked in.
    const rows = chunkBrsrTable(pages);
    console.log(`Detected ${rows.length} BRSR Q-rows.`);
    for (const row of rows) {
      // Reconstruct path for the chunker output. The path components are
      // implicit in the synthesized number (A.Q14 / C.P3.E.Q5).
      const path = brsrSectionPath(row);
      chunks = chunks.concat(splitSection(row, path));
    }
  } else {
    const sections = chunkBySection(pages, HEADING_MODE);
    console.log(`Detected ${sections.length} numbered sections (mode=${HEADING_MODE}).`);
    const leaves = keepLeafSections(sections);
    console.log(`${leaves.length} are leaf sections (no deeper subsections).`);

    const sectionPathFor = buildSectionPaths(sections);
    for (const leaf of leaves) {
      const path = sectionPathFor(leaf);
      chunks = chunks.concat(splitSection(leaf, path));
    }
  }
  console.log(`Produced ${chunks.length} chunks (post-split).`);

  if (DRY_RUN) {
    const sliceN = process.env.DRY_RUN_ALL ? chunks.length : 5;
    console.log(`Dry run — ${process.env.DRY_RUN_ALL ? "all" : "first 5"} chunks:`);
    for (const c of chunks.slice(0, sliceN)) {
      console.log(`\n§${c.sectionNumber} ${c.sectionTitle} (p${c.firstPage}-${c.lastPage}) [${c.text.length} chars]`);
      if (process.env.DRY_RUN_ALL) {
        // Just the header line for full dump.
      } else {
        console.log(c.text.slice(0, 300) + (c.text.length > 300 ? "..." : ""));
      }
    }
    return;
  }

  const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

  // Reuse a previous contextualization if present — context generation is the
  // expensive step (~$0.50, 3-5 min). The embed step is cheap and fast, so
  // if it fails we don't want to redo contextualization on the retry.
  let contextualized;
  if (SKIP_CONTEXTUAL) {
    console.log(
      `Skipping Anthropic Contextual Retrieval (--skip-contextual or framework default).` +
        ` Chunks will be embedded with sectionPath + title + text only.`
    );
    // Synthesize a deterministic context from the section path so the
    // embedding still gets some structural signal even without an LLM blurb.
    contextualized = chunks.map((c) => ({
      ...c,
      context: `Section ${c.sectionNumber} ${c.sectionTitle}. Path: ${c.sectionPath.join(" > ")}.`,
    }));
  } else {
    const anthropic = new Anthropic();
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
        framework: FRAMEWORK,
        pdfPath: PDF_PATH,
        builtAt: new Date().toISOString(),
        embedModel: EMBED_MODEL,
        contextualizerModel: SKIP_CONTEXTUAL ? null : CONTEXTUALIZER_MODEL,
        contextualRetrieval: !SKIP_CONTEXTUAL,
        chunkCount: contextualized.length,
        pageCount: pages.length,
        firstBodyPage: FIRST_BODY_PAGE,
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
