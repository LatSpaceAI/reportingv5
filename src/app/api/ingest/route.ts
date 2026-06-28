// PDF ingestion route — parses an uploaded PDF, chunks + embeds it, builds a
// BM25 index, and writes a self-contained index JSON to Vercel Blob. The
// AI-Context tab calls this; the returned blobUrl is stored in localStorage and
// later handed to the agent runner (which fetches the index at query time via
// the search_user_docs tool).
//
// We reuse the SAME chunking / embedding / BM25 primitives the runner uses by
// importing from agent-runner/lib/rag/* (the canonical RAG lib). This route
// runs on Vercel proper (not in the sandbox), so it constructs its own Voyage
// client and reads VOYAGE_API_KEY / BLOB_READ_WRITE_TOKEN from the env.

import { NextRequest } from "next/server";
import { createRequire } from "node:module";
import { put } from "@vercel/blob";
import { PDFParse } from "pdf-parse";

import { chunkPdfPages, type PdfPage } from "@/lib/rag/chunk";
import { buildBm25Index, embedDocuments, type VoyageEmbedder } from "@/lib/rag/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Embedding a large PDF can take a while; mirror the chat route's streaming cap.
// On Hobby this drops to 60 — see DEPLOY.md plan tuning.
export const maxDuration = 800;

// voyageai's ESM build does directory imports Node's native resolver rejects;
// the CJS entry works (same workaround as scripts/build-index.mjs).
const require = createRequire(import.meta.url);
const { VoyageAIClient } = require("voyageai") as typeof import("voyageai");

const EMBED_MODEL = "voyage-3-large";
const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_PAGES = 120; // cap pages embedded to bound cost/time
const MAX_CHUNKS = 1500; // hard ceiling on chunks per doc

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!process.env.VOYAGE_API_KEY) {
    return json({ error: "VOYAGE_API_KEY is not set on the server." }, 500);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json({ error: "BLOB_READ_WRITE_TOKEN is not set on the server." }, 500);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Expected multipart/form-data with a 'file' field." }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return json({ error: "No file uploaded under the 'file' field." }, 400);
  }
  const name = file.name || "document.pdf";
  const isPdf =
    file.type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return json({ error: "Only PDF files are supported." }, 415);
  }
  if (file.size > MAX_PDF_BYTES) {
    return json(
      { error: `PDF is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is ${MAX_PDF_BYTES / 1024 / 1024} MB.` },
      413
    );
  }

  const docId = `u_${crypto.randomUUID().slice(0, 8)}`;
  let warning: string | undefined;

  try {
    // 1. Parse PDF → pages.
    const buf = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const result = await parser.getText({ pageJoiner: "" });
    await parser.destroy();

    let pages: PdfPage[] = result.pages.map((p) => ({ num: p.num, text: p.text }));
    if (pages.length > MAX_PAGES) {
      warning = `Only the first ${MAX_PAGES} of ${pages.length} pages were indexed.`;
      pages = pages.slice(0, MAX_PAGES);
    }

    // 2. Chunk (generic paragraph-packing chunker — no section structure).
    let chunks = chunkPdfPages(pages, { docId, docName: name });
    if (!chunks.length) {
      return json(
        { error: "No extractable text found. This may be a scanned/image-only PDF." },
        422
      );
    }
    if (chunks.length > MAX_CHUNKS) {
      warning = `${warning ? warning + " " : ""}Indexed the first ${MAX_CHUNKS} of ${chunks.length} chunks.`;
      chunks = chunks.slice(0, MAX_CHUNKS);
    }

    // 3. Embed (context + body) via Voyage, batched with fallbacks.
    const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY }) as unknown as VoyageEmbedder;
    const inputs = chunks.map((c) => `${c.context}\n\n${c.text}`);
    const vectors = await embedDocuments(voyage, inputs, EMBED_MODEL);

    // 4. BM25 index over the same searchable text.
    const bm25 = buildBm25Index(chunks);

    // 5. Assemble the self-contained index JSON.
    const index = {
      version: 1,
      docId,
      docName: name,
      embedModel: EMBED_MODEL,
      builtAt: new Date().toISOString(),
      pageCount: pages.length,
      chunkCount: chunks.length,
      chunks,
      vectors,
      bm25,
    };

    // 6. Write to Vercel Blob (public so the sandbox can fetch it; the firewall
    //    already allows *.public.blob.vercel-storage.com).
    const blob = await put(`rag/user/${docId}/index.json`, JSON.stringify(index), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });

    return json({
      id: docId,
      name,
      blobUrl: blob.url,
      chunkCount: chunks.length,
      pageCount: pages.length,
      sizeBytes: file.size,
      warning,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ingest] failed", { docId, name, message });
    return json({ error: `Ingestion failed: ${message}` }, 500);
  }
}
