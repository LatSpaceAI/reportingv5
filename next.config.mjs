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
  },
};
export default nextConfig;
