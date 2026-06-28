// Client-upload token route for knowledge-doc PDFs.
//
// Vercel serverless functions cap the REQUEST body at ~4.5 MB, so a direct
// multipart POST of a 15 MB PDF to /api/ingest is rejected by the platform
// (HTTP 413) before our handler runs. The fix is Vercel Blob *client uploads*:
// the browser uploads the PDF straight to Blob storage, and this route only
// hands out a short-lived, scoped upload token (a tiny request/response, well
// under the limit). The browser then calls /api/ingest with just the Blob URL.
//
// See @vercel/blob handleUpload docs. The raw PDF is uploaded under
// rag/user/_src/ with a random suffix; the ingest route reads it back, builds
// the index, and writes the final rag/user/<id>/index.json.

import { NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 15 * 1024 * 1024; // keep in sync with /api/ingest

export async function POST(req: NextRequest): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response(
      JSON.stringify({ error: "BLOB_READ_WRITE_TOKEN is not set on the server." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => {
        // Only allow PDFs into the source area, with a hard size ceiling.
        if (!pathname.toLowerCase().endsWith(".pdf")) {
          throw new Error("Only PDF files are supported.");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_BYTES,
          addRandomSuffix: true,
        };
      },
      // Nothing to do on completion — the browser drives ingest itself with the
      // returned Blob URL. (This callback only fires in deployed envs anyway.)
      onUploadCompleted: async () => {},
    });
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
