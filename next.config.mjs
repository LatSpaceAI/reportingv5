/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is retained so the Railway/AppRunner Dockerfile still
  // builds during the cutover week. Once the Vercel + Sandbox deployment is
  // proven in production, the Dockerfile/railway.json/standalone output can
  // all be removed together.
  output: "standalone",
  // The agent SDK and RAG index now live inside agent-runner/, which ships
  // into Vercel Sandbox at request time — neither needs to be traced into
  // any Next route bundle. The dispatcher routes only depend on
  // @vercel/sandbox which Next traces automatically.
  experimental: {
    // Keep agent-runner out of the Next build entirely.
    outputFileTracingExcludes: {
      "*": ["./agent-runner/**/*"],
    },
    // pdf-parse pulls in pdfjs-dist, which does dynamic require()s of Node
    // built-ins and optional native deps that webpack can't bundle — it crashes
    // the /api/ingest route at module load (HTTP 500 with an HTML error page).
    // Leave these as runtime requires instead of bundling them.
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
    // Externalizing the packages stops webpack bundling them, but with
    // `output: "standalone"` the package files must still be TRACED into the
    // lambda or the runtime `require` resolves to nothing and the function
    // crashes at module load (FUNCTION_INVOCATION_FAILED, ~immediate, no
    // outgoing requests, /500 HTML page). Force-include both packages so their
    // files ship in the /api/ingest lambda.
    outputFileTracingIncludes: {
      "/api/ingest": [
        "./node_modules/pdf-parse/**/*",
        "./node_modules/pdfjs-dist/**/*",
      ],
      // The BRSR export opens the client's real template workbook with ExcelJS
      // at request time. Nothing imports the .xlsx, so tracing never discovers
      // it and the route 404s on Vercel ("template workbook was not found").
      // Force it into the lambda.
      "/api/esg/export/environment": [
        "./src/lib/brsrExport/template/*.xlsx",
      ],
    },
  },
};
export default nextConfig;
