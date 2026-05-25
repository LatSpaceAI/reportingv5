// One-time indexing pipeline for the CBAM guidance PDF.
//
// Reads the PDF, splits it into leaf-section chunks (respecting numbered
// headings like 1, 1.1, 1.1.1...), runs Anthropic Contextual Retrieval to
// generate per-chunk context blurbs (prompt-cached on the document), embeds
// each (context + body) with Voyage AI, and writes the index files the
// runtime route loads on cold start.
//
// Usage:
//   node scripts/build-index.mjs                                 # CBAM, incremental
//   node scripts/build-index.mjs --force                         # rebuild from scratch
//   node scripts/build-index.mjs --dry-run                       # parse + chunk only, no API calls
//   node scripts/build-index.mjs --first-page 5                  # override skipped front-matter pages

import { config as loadEnv } from "dotenv";
// override: true so .env.local wins over any empty/stale shell env vars.
loadEnv({ path: [".env.local", ".env"], override: true });
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
    chunker: "cbam",
  },
  ccts: {
    pdfPath: "Detailed Procedure for Compliance Mechanism - BEE document (1).pdf",
    // Page 7 is the TOC (parsed for top-level section titles). Page 8 onward is body.
    firstBodyPage: 7,
    skipContextual: false,
    chunker: "bee",
    tocPage: 7,
  },
};

const fwDefaults = FRAMEWORK_DEFAULTS[FRAMEWORK];
if (!fwDefaults) {
  console.error(`Unknown framework "${FRAMEWORK}". Known: ${Object.keys(FRAMEWORK_DEFAULTS).join(", ")}`);
  process.exit(1);
}

const PDF_PATH = resolve(PROJECT_ROOT, flagValue("--pdf") ?? fwDefaults.pdfPath);
const INDEX_DIR = join(PROJECT_ROOT, "agent-runner", "data", "rag", FRAMEWORK);
const SKIP_CONTEXTUAL = SKIP_CONTEXTUAL_FLAG || fwDefaults.skipContextual === true;
const CHUNKS_PATH = join(INDEX_DIR, "chunks.json");
const VECTORS_PATH = join(INDEX_DIR, "vectors.json");
const META_PATH = join(INDEX_DIR, "meta.json");
const CONTEXTUALIZED_CHECKPOINT = join(INDEX_DIR, ".contextualized.json");
const CHUNKER = fwDefaults.chunker ?? "cbam";
const TOC_PAGE = fwDefaults.tocPage ?? null;

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

// ---------- BEE-style section detection ----------
//
// The BEE "Detailed Procedure for Compliance Mechanism" PDF has a different
// layout from CBAM:
//   - Top-level section titles ("1. Definitions", "2. Introduction", ...) appear
//     only in the TOC and as page-bottom captions, not as inline headings.
//   - Subsection headings ("4.1. Inclusion of Obligated Entities...", "5.10
//     Internal Laboratory Analysis") appear inline at the top of their content,
//     usually with a trailing period after the number.
//   - Numbered list items ("1.", "2.", "3.") inside body prose are noisy — they
//     match the same shape as top-level captions.
//
// Strategy:
//   1. Parse the TOC (single page) to get the canonical {number, title} list
//      of top-level sections.
//   2. For each body page, decide which top-level section it belongs to by
//      detecting the page-bottom caption line matching a TOC entry: that page
//      is the LAST page of that top-level section.
//   3. Within a top-level section, detect subsection headers (multi-component
//      number with trailing period, e.g. "4.1.", "5.10.") and split there.
//   4. If a top-level has no detected subsections, emit one section containing
//      the whole top-level's text.
function parseBeeToc(tocPage) {
  // TOC lines look like: "1. \tDefinitions \t01" or "10. Banking of Carbon Credit Certificates \t28".
  // Number is followed by a period then the title then a page number.
  const lines = tocPage.text.split("\n");
  const entries = [];
  const re = /^(\d{1,2})\.\s+(.+?)\s+(\d{1,3})\s*$/;
  for (const raw of lines) {
    const line = raw.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    const m = line.match(re);
    if (!m) continue;
    const num = Number(m[1]);
    const title = m[2].trim();
    const startPage = Number(m[3]);
    if (num < 1 || num > 50) continue;
    if (title.length < 3 || title.length > 100) continue;
    entries.push({ number: String(num), title, tocPage: startPage });
  }
  return entries;
}

// Roman numeral → arabic for Annexure detection.
const ROMAN_TO_ARABIC = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

// Match a BEE Annexure marker. These appear at the BOTTOM of the first page of
// each annexure, on two lines: "Annexure X" then a title line.
function looksLikeAnnexureMarker(line) {
  const m = line.match(/^Annexure\s+(I{1,3}|IV|V|VI|VII|VIII|IX|X)\s*$/i);
  if (!m) return null;
  const roman = m[1].toUpperCase();
  const num = ROMAN_TO_ARABIC[roman];
  if (!num) return null;
  return { number: `A${num}`, roman };
}

// Match BEE inline subsection headers: multi-component number with trailing
// period, e.g. "4.1.", "5.10.", "6.2.1.". Single-component numbers (just "1.")
// are rejected — those are list items, not headings.
const BEE_SUBSECTION_RE = /^(\d+\.\d+(?:\.\d+){0,2})\.?\s+(.+?)\s*$/;

function looksLikeBeeSubsection(line) {
  const m = line.match(BEE_SUBSECTION_RE);
  if (!m) return null;
  const [, number, title] = m;
  // Numeric sanity check.
  const parts = number.split(".").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts[0] < 1 || parts[0] > 14) return null;
  // Title needs to be short, headline-style — not prose. Headings in BEE are
  // typically ≤ ~80 chars and don't contain sentence-ending punctuation.
  if (title.length < 3 || title.length > 100) return null;
  if (/[.][\s]\S/.test(title)) return null;
  return { number, title: title.trim() };
}

// Find the page-bottom caption that names the current top-level section.
// E.g. page 8 ends with line "1. Definitions"; page 10 with "2. Introduction".
// We match against the TOC entry titles so list-item lines like "1. Activity data
// means..." don't trigger.
function matchTopLevelCaption(line, tocEntries) {
  const m = line.match(/^(\d{1,2})\.\s+(.+?)\s*$/);
  if (!m) return null;
  const num = m[1];
  const captionTitle = m[2].trim().toLowerCase();
  const entry = tocEntries.find((e) => e.number === num);
  if (!entry) return null;
  // The caption may wrap onto two lines in the PDF (e.g. "8. Issuance and Surrender of \n Carbon Credit Certificate").
  // We accept a partial-prefix match too — if the caption text is a prefix of the TOC title (or vice versa).
  const tocTitle = entry.title.toLowerCase();
  if (captionTitle === tocTitle) return entry;
  if (tocTitle.startsWith(captionTitle) && captionTitle.length >= 6) return entry;
  if (captionTitle.startsWith(tocTitle.slice(0, Math.min(20, tocTitle.length)))) return entry;
  return null;
}

function chunkBySectionBee(pages, tocPageNum) {
  // Find and parse the TOC page.
  const tocPage = pages.find((p) => p.num === tocPageNum);
  if (!tocPage) {
    throw new Error(`BEE chunker: TOC page ${tocPageNum} not in parsed pages`);
  }
  const tocEntries = parseBeeToc(tocPage);
  if (tocEntries.length < 5) {
    throw new Error(`BEE chunker: parsed only ${tocEntries.length} TOC entries; expected ~14`);
  }
  console.log(`Parsed ${tocEntries.length} TOC entries:`);
  for (const e of tocEntries) console.log(`  ${e.number}. ${e.title}`);

  // Walk body pages (everything after the TOC). Determine the current top-level
  // by detecting page-bottom captions; everything before the first caption
  // belongs to top-level "1".
  const bodyPages = pages.filter((p) => p.num > tocPageNum);

  // First pass: build a map of topLevelNumber → startPageNum by scanning each
  // page's bottom region for a page-bottom caption that matches a TOC entry.
  // Captions appear near the bottom of the FIRST page of each top-level section
  // (BEE convention — a decorative page footer naming the section that starts
  // on that page). If a section has multiple body pages, only the first carries
  // the caption; continuation pages have no caption.
  const startPageOf = new Map(); // topLevelNumber → startPageNum
  for (const p of bodyPages) {
    const lines = p.text.split("\n").map((l) => l.replace(/\t/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
    // Scan last ~6 lines for a caption. First match wins per page.
    for (let i = Math.max(0, lines.length - 6); i < lines.length; i++) {
      const entry = matchTopLevelCaption(lines[i], tocEntries);
      if (entry && !startPageOf.has(entry.number)) {
        startPageOf.set(entry.number, p.num);
        break;
      }
    }
  }

  // §14 Annexures doesn't follow the same page-bottom-caption convention. If
  // it wasn't detected above, find the first page containing an "Annexure I"
  // marker and treat that as §14's start.
  if (!startPageOf.has("14")) {
    for (const p of bodyPages) {
      const lines = p.text.split("\n").map((l) => l.replace(/\t/g, " ").trim()).filter(Boolean);
      for (const line of lines) {
        const m = looksLikeAnnexureMarker(line);
        if (m && m.number === "A1") {
          startPageOf.set("14", p.num);
          break;
        }
      }
      if (startPageOf.has("14")) break;
    }
  }

  // Build a sorted list of (topLevelNumber, startPage) so we can assign every
  // body page to the closest preceding-or-equal start.
  const orderedTopLevels = tocEntries
    .filter((e) => startPageOf.has(e.number))
    .map((e) => ({ ...e, startPage: startPageOf.get(e.number) }))
    .sort((a, b) => a.startPage - b.startPage);

  const assignedTopLevel = new Map(); // pageNum → topLevelNumber
  for (const p of bodyPages) {
    let chosen = null;
    for (const tl of orderedTopLevels) {
      if (p.num >= tl.startPage) chosen = tl;
      else break;
    }
    if (chosen) assignedTopLevel.set(p.num, chosen.number);
  }

  // Second pass: walk pages in order, building sections. Within each top-level,
  // split on inline subsection headers; if none found in that top-level's pages,
  // emit one section for the whole top-level.
  const tocByNumber = new Map(tocEntries.map((e) => [e.number, e]));
  const sections = [];

  // Group pages by assigned top-level (preserve order).
  const pagesByTopLevel = new Map();
  for (const p of bodyPages) {
    const tl = assignedTopLevel.get(p.num);
    if (!tl) continue;
    if (!pagesByTopLevel.has(tl)) pagesByTopLevel.set(tl, []);
    pagesByTopLevel.get(tl).push(p);
  }

  for (const [topLevel, pagesInTL] of pagesByTopLevel) {
    const tocEntry = tocByNumber.get(topLevel);
    if (!tocEntry) continue;

    // §14 Annexures uses Roman-numeral markers ("Annexure I", "Annexure II", ...)
    // instead of numeric subsections. Handle it separately.
    if (topLevel === "14") {
      const annexures = chunkAnnexures(pagesInTL, tocEntry, tocEntries);
      sections.push(...annexures);
      continue;
    }

    // Walk this top-level's pages line-by-line, splitting on inline subsection headers.
    const subsections = [];
    let current = null;
    let hasAnySubsection = false;

    for (const page of pagesInTL) {
      const rawLines = page.text.split("\n");
      for (const raw of rawLines) {
        const line = raw.replace(/\t/g, " ").trim();
        if (!line) continue;

        // Skip page-bottom captions (they're not body content).
        if (matchTopLevelCaption(line, tocEntries)) continue;

        // Only consider multi-component numbers that ALSO start with the current top-level.
        const sub = looksLikeBeeSubsection(line);
        if (sub && sub.number.startsWith(topLevel + ".")) {
          hasAnySubsection = true;
          if (current) subsections.push(current);
          current = {
            number: sub.number,
            title: sub.title,
            firstPage: page.num,
            lastPage: page.num,
            body: [],
            topLevel,
          };
          continue;
        }

        if (current) {
          // Inject a paragraph break when a numbered/lettered list item starts
          // (e.g. "1.", "2.", "a.", "i.", "(i)"). PDF flattens line breaks so
          // splitSection's paragraph-splitter needs these hints to subdivide
          // long sections.
          if (current.body.length > 0 && /^(\d{1,2}|[a-z]|[ivx]{1,4})\.\s/.test(line)) {
            current.body.push("");
          }
          current.body.push(line);
          current.lastPage = page.num;
        } else {
          // No subsection seen yet — accumulate under a synthetic top-level section.
          if (!current) {
            current = {
              number: topLevel,
              title: tocEntry.title,
              firstPage: page.num,
              lastPage: page.num,
              body: [],
              topLevel,
            };
          }
        }
      }
    }
    if (current) subsections.push(current);

    if (!hasAnySubsection && subsections.length === 1) {
      // Force the single accumulated section to use the top-level identity.
      subsections[0].number = topLevel;
      subsections[0].title = tocEntry.title;
    }

    sections.push(...subsections);
  }

  return { sections, tocByNumber };
}

// Split the Annexures (§14) into one section per Annexure. The PDF places
// "Annexure X" and the annexure title as TWO lines near the bottom of the
// FIRST page of each annexure (same page-footer pattern as top-level captions).
function chunkAnnexures(pages, tocEntry, tocEntries) {
  // First pass: find each Annexure's start page by scanning page bottoms.
  // The marker on the first page is two lines: "Annexure I" then the title.
  const annexStarts = []; // { number, title, startPage }
  for (const p of pages) {
    const lines = p.text.split("\n").map((l) => l.replace(/\t/g, " ").trim()).filter(Boolean);
    for (let i = Math.max(0, lines.length - 6); i < lines.length; i++) {
      const m = looksLikeAnnexureMarker(lines[i]);
      if (m) {
        // The next non-empty line below should be the annexure title.
        const title = lines[i + 1] && lines[i + 1].length <= 100 ? lines[i + 1] : `Annexure ${m.roman}`;
        if (!annexStarts.some((a) => a.number === m.number)) {
          annexStarts.push({ number: m.number, title, startPage: p.num, roman: m.roman });
        }
        break;
      }
    }
  }

  if (annexStarts.length === 0) {
    // No annexure markers found — emit a single §14 chunk for the whole range.
    const body = pages.flatMap((p) => p.text.split("\n").map((l) => l.trim()).filter(Boolean));
    return [
      {
        number: "14",
        title: tocEntry.title,
        firstPage: pages[0]?.num ?? 0,
        lastPage: pages[pages.length - 1]?.num ?? 0,
        body,
        topLevel: "14",
      },
    ];
  }

  // Sort by start page.
  annexStarts.sort((a, b) => a.startPage - b.startPage);

  // Second pass: assign every page to the nearest preceding-or-equal annexure.
  const sections = [];
  for (let i = 0; i < annexStarts.length; i++) {
    const start = annexStarts[i].startPage;
    const end = i + 1 < annexStarts.length ? annexStarts[i + 1].startPage - 1 : pages[pages.length - 1].num;
    const annexPages = pages.filter((p) => p.num >= start && p.num <= end);
    const body = [];
    for (const p of annexPages) {
      for (const raw of p.text.split("\n")) {
        const line = raw.replace(/\t/g, " ").trim();
        if (!line) continue;
        // Skip top-level captions and Annexure markers themselves.
        if (matchTopLevelCaption(line, tocEntries)) continue;
        if (looksLikeAnnexureMarker(line)) continue;
        body.push(line);
      }
    }
    sections.push({
      number: `14.${i + 1}`,
      title: `${annexStarts[i].title} (Annexure ${annexStarts[i].roman})`,
      firstPage: start,
      lastPage: end,
      body,
      topLevel: "14",
    });
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
  console.log(`Contextual retrieval: ${SKIP_CONTEXTUAL ? "SKIPPED" : "enabled"}`);

  const pages = await parsePdf();
  const fullDocText = sanitizeText(
    pages.map((p) => `[Page ${p.num}]\n${p.text}`).join("\n\n")
  );

  let chunks = [];
  if (CHUNKER === "bee") {
    if (!TOC_PAGE) {
      throw new Error(`BEE chunker requires tocPage in FRAMEWORK_DEFAULTS for ${FRAMEWORK}`);
    }
    const { sections, tocByNumber } = chunkBySectionBee(pages, TOC_PAGE);
    console.log(`BEE chunker produced ${sections.length} leaf sections.`);
    const sectionPathForBee = (sec) => {
      const path = [];
      // Walk top-level → subsection.
      const parts = sec.number.split(".");
      // First component → top-level title from TOC.
      const topNum = parts[0];
      const top = tocByNumber.get(topNum);
      if (top) path.push(`${topNum} ${top.title}`);
      // For multi-component, append the leaf itself if it's not already the top.
      if (parts.length > 1) path.push(`${sec.number} ${sec.title}`);
      return path;
    };
    for (const sec of sections) {
      const path = sectionPathForBee(sec);
      chunks = chunks.concat(splitSection(sec, path));
    }
  } else {
    const sections = chunkBySection(pages);
    console.log(`Detected ${sections.length} numbered sections.`);
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
