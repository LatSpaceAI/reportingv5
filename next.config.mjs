/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure the prebuilt RAG index is bundled with the chat route's
  // serverless function on Vercel. Without this, runtime fs reads of
  // data/rag/* fail in the deployed environment.
  experimental: {
    outputFileTracingIncludes: {
      "/api/chat": ["./data/rag/**/*"],
    },
  },
};
export default nextConfig;
