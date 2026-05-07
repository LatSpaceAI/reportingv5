/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure the prebuilt RAG index AND the platform-native Claude Code CLI
  // are bundled into the serverless function on Vercel. Without these,
  // runtime fs reads of data/rag/* and the Agent SDK's spawn of the
  // `claude` binary fail with "Native CLI binary for linux-x64 not found".
  experimental: {
    outputFileTracingIncludes: {
      "/api/chat": [
        "./data/rag/**/*",
        "./node_modules/@anthropic-ai/claude-code/**/*",
        "./node_modules/@anthropic-ai/claude-code-linux-x64/**/*",
      ],
      "/api/write": [
        "./data/rag/**/*",
        "./node_modules/@anthropic-ai/claude-code/**/*",
        "./node_modules/@anthropic-ai/claude-code-linux-x64/**/*",
      ],
    },
  },
};
export default nextConfig;
