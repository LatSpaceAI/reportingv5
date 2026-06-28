// Generic PDF chunker — the Next.js-side copy. Canonical version lives in
// agent-runner/lib/rag/chunk.ts; see src/lib/rag/core.ts for why this is
// duplicated rather than imported across the runner/Next build boundary. Keep
// in sync with the runner copy.

import { sanitizeText, type RagChunk } from "./core";

const MAX_CHUNK_CHARS = 4000; // ~1000 tokens
const CHUNK_OVERLAP_CHARS = 400;

export interface PdfPage {
  num: number;
  text: string;
}

export interface ChunkPdfOptions {
  docId: string;
  docName: string;
  maxChunkChars?: number;
  overlapChars?: number;
}

interface ParaUnit {
  text: string;
  page: number;
}

function pageParagraphs(page: PdfPage): ParaUnit[] {
  const clean = sanitizeText(page.text);
  if (!clean) return [];
  return clean
    .split(/\n{2,}|\n(?=\s*[•\-])/g)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text) => ({ text, page: page.num }));
}

export function chunkPdfPages(pages: PdfPage[], opts: ChunkPdfOptions): RagChunk[] {
  const maxChars = opts.maxChunkChars ?? MAX_CHUNK_CHARS;
  const overlap = opts.overlapChars ?? CHUNK_OVERLAP_CHARS;

  const units: ParaUnit[] = [];
  for (const page of pages) units.push(...pageParagraphs(page));
  if (!units.length) return [];

  const chunks: RagChunk[] = [];
  let buf = "";
  let bufFirstPage = units[0].page;
  let bufLastPage = units[0].page;
  let chunkIndex = 0;

  const flush = () => {
    const text = buf.trim();
    if (!text) return;
    chunks.push({
      text,
      context:
        bufFirstPage === bufLastPage
          ? `Document: ${opts.docName}. Page ${bufFirstPage}.`
          : `Document: ${opts.docName}. Pages ${bufFirstPage}-${bufLastPage}.`,
      firstPage: bufFirstPage,
      lastPage: bufLastPage,
      chunkIndex: chunkIndex++,
      docId: opts.docId,
      docName: opts.docName,
    });
  };

  for (const unit of units) {
    const next = buf ? `${buf}\n\n${unit.text}` : unit.text;
    if (next.length > maxChars && buf) {
      flush();
      const tail = buf.slice(Math.max(0, buf.length - overlap));
      buf = `${tail}\n\n${unit.text}`;
      bufFirstPage = unit.page;
      bufLastPage = unit.page;
    } else {
      if (!buf) bufFirstPage = unit.page;
      buf = next;
      bufLastPage = unit.page;
    }
  }
  flush();
  return chunks;
}
