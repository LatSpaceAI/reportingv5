"use client";

// Knowledge documents uploader for the AI-Context tab. The user uploads PDFs.
//
// Upload is two-step, to dodge Vercel's ~4.5 MB serverless request-body cap:
//   1. the PDF is uploaded DIRECTLY to Vercel Blob from the browser via
//      @vercel/blob/client `upload()` (authorized by /api/ingest/upload-token),
//   2. then we POST the resulting Blob URL to /api/ingest, which fetches the
//      PDF, parses/chunks/embeds it, and stores a RAG index in Blob.
// We track lightweight metadata in localStorage (lib/userDocs.ts); the
// AssistantPane sends the ready docs with each chat / write request so the
// agent can retrieve from them via search_user_docs.

import { useEffect, useRef, useState } from "react";

import { upload } from "@vercel/blob/client";

import { useToast } from "@/components/Toast";
import {
  readUserDocs,
  upsertUserDoc,
  removeUserDoc,
  USER_DOCS_UPDATED_EVENT,
  type UserDocMeta,
} from "@/lib/userDocs";

const labelClass =
  "block text-[11px] text-brand tracking-[0.15em] uppercase font-medium mb-2";

// Keep in sync with MAX_PDF_BYTES in /api/ingest and the upload-token route.
const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// A short client id for an in-flight upload, before the server assigns one.
function tempId(): string {
  return `tmp_${Math.random().toString(36).slice(2, 10)}`;
}

interface IngestResponse {
  id: string;
  name: string;
  blobUrl: string;
  chunkCount: number;
  pageCount: number;
  sizeBytes: number;
  warning?: string;
}

export default function UserDocsUpload() {
  const { show } = useToast();
  const [docs, setDocs] = useState<UserDocMeta[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => setDocs(readUserDocs());
    sync();
    window.addEventListener(USER_DOCS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(USER_DOCS_UPDATED_EVENT, sync);
  }, []);

  const uploadFile = async (file: File) => {
    const id = tempId();
    const now = new Date().toISOString();
    // Optimistic row with a spinner.
    upsertUserDoc({
      id,
      name: file.name,
      blobUrl: "",
      chunkCount: 0,
      pageCount: 0,
      sizeBytes: file.size,
      status: "uploading",
      updatedAt: now,
    });

    try {
      // 1. Upload the raw PDF straight to Blob (bypasses the 4.5 MB body cap).
      //    The .pdf suffix is required by the upload-token route's validation.
      const safeName = file.name.toLowerCase().endsWith(".pdf")
        ? file.name
        : `${file.name}.pdf`;
      const blob = await upload(`rag/user/_src/${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/ingest/upload-token",
        contentType: "application/pdf",
      });

      // 2. Hand the Blob URL to the ingest route (tiny JSON body).
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfUrl: blob.url,
          name: file.name,
          sizeBytes: file.size,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Upload failed (HTTP ${res.status})`);
      }
      const data = (await res.json()) as IngestResponse;
      // Replace the temp row with the real one (new id from the server).
      removeUserDoc(id);
      upsertUserDoc({
        id: data.id,
        name: data.name,
        blobUrl: data.blobUrl,
        chunkCount: data.chunkCount,
        pageCount: data.pageCount,
        sizeBytes: data.sizeBytes,
        status: "ready",
        warning: data.warning,
        updatedAt: new Date().toISOString(),
      });
      show(
        data.warning
          ? `Added "${data.name}". ${data.warning}`
          : `Added "${data.name}" (${data.chunkCount} chunks).`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      upsertUserDoc({
        id,
        name: file.name,
        blobUrl: "",
        chunkCount: 0,
        pageCount: 0,
        sizeBytes: file.size,
        status: "failed",
        error: message,
        updatedAt: new Date().toISOString(),
      });
      show(message);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        show(`"${file.name}" isn't a PDF. Only PDF files are supported.`);
        continue;
      }
      if (file.size > MAX_PDF_BYTES) {
        show(
          `"${file.name}" is ${formatBytes(file.size)} — over the ${MAX_PDF_BYTES / 1024 / 1024} MB limit.`
        );
        continue;
      }
      void uploadFile(file);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="border border-gray-200 p-6">
      <div className="mb-5">
        <h2 className="text-[13px] font-semibold text-[#0A0A0A]">
          Knowledge documents
        </h2>
        <p className="mt-1 max-w-[440px] text-[12px] leading-relaxed text-gray-500">
          Upload PDFs — policies, prior reports, internal data — and the AI
          assistant can retrieve from them when answering and drafting. Large
          documents are supported; text is indexed for search, not pasted whole.
        </p>
      </div>

      <label className={labelClass}>Upload PDF</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center border border-dashed px-4 py-8 text-center transition-colors ${
          dragging ? "border-brand bg-brand/[0.04]" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="text-sm text-gray-600">
          Drag a PDF here, or <span className="text-brand underline">browse</span>
        </p>
        <p className="mt-1 text-[11px] text-gray-400">PDF only · up to 15 MB each</p>
      </div>

      {docs.length > 0 && (
        <ul className="mt-5 divide-y divide-gray-100 border border-gray-100">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[#0A0A0A]">{doc.name}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {doc.status === "uploading" && "Processing…"}
                  {doc.status === "ready" &&
                    `${doc.pageCount} pages · ${doc.chunkCount} chunks · ${formatBytes(doc.sizeBytes)}`}
                  {doc.status === "failed" && (
                    <span className="text-red-500">{doc.error || "Failed"}</span>
                  )}
                  {doc.status === "ready" && doc.warning && (
                    <span className="text-amber-600"> · {doc.warning}</span>
                  )}
                </p>
              </div>

              {doc.status === "uploading" ? (
                <span
                  className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-brand"
                  aria-label="Processing"
                />
              ) : (
                <span
                  className={`flex-shrink-0 text-[10px] uppercase tracking-wider ${
                    doc.status === "ready" ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {doc.status === "ready" ? "Ready" : "Failed"}
                </span>
              )}

              <button
                type="button"
                onClick={() => removeUserDoc(doc.id)}
                disabled={doc.status === "uploading"}
                aria-label={`Remove ${doc.name}`}
                title="Remove document"
                className="flex-shrink-0 text-gray-300 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
