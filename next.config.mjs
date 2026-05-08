/** @type {import('next').NextConfig} */
const nextConfig = {
  // Slim runner image for container deploys (App Runner / ECS / etc.).
  // Produces .next/standalone/server.js with only the deps the routes
  // actually trace into, instead of dragging in all of node_modules.
  output: "standalone",
  experimental: {
    outputFileTracingIncludes: {
      // Both AI routes call into the prebuilt RAG index (chat directly,
      // write via the search_guidance MCP tool).
      "/api/chat": [
        "./data/rag/**/*",
        "./node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/**/*",
        "./node_modules/@anthropic-ai/claude-agent-sdk/**/*",
      ],
      "/api/write": [
        "./data/rag/**/*",
        "./node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/**/*",
        "./node_modules/@anthropic-ai/claude-agent-sdk/**/*",
      ],
    },
  },
};
export default nextConfig;
