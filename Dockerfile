# Multi-stage Dockerfile for the CBAM/CDP/BRSR reporting app.
#
# The app embeds the Claude Agent SDK, which ships a ~250 MB native Linux
# binary at node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude.
# That binary is dynamically linked against glibc, so the runner stage MUST
# be a glibc base (debian/ubuntu) — alpine/musl will fail at exec time.
#
# next.config.mjs sets `output: "standalone"` and traces both
# @anthropic-ai/claude-agent-sdk + @anthropic-ai/claude-agent-sdk-linux-x64
# into the route bundle, so the standalone output already contains the SDK
# binary under .next/standalone/node_modules/...
#
# Target platform: linux/amd64 (the Agent SDK only ships linux-x64 today).

# ----- deps -----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ----- build -----
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ----- runner -----
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
# NOTE: deliberately do NOT set HOSTNAME via ENV. App Runner injects its
# own HOSTNAME=<task-hostname> at runtime which would override an ENV
# default, causing Next standalone to bind to the container's interface
# IP only — App Runner's health checker on a different network namespace
# can't reach it. We force 0.0.0.0 in the CMD wrapper below instead.

# Run as non-root. The 'node' user (uid 1000) ships with the base image.
RUN groupadd --system --gid 1001 nextjs \
 && useradd --system --uid 1001 --gid nextjs nextjs

# Standalone output contains a minimal server.js + only the deps Next traced.
# Public assets and .next/static are not bundled into standalone — copy them
# explicitly. Same for data/rag, which retrieval.ts reads from process.cwd().
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nextjs /app/public ./public
COPY --from=build --chown=nextjs:nextjs /app/data ./data

# The Agent SDK's bundled CLI binary needs +x. npm preserves perms, but
# being explicit avoids surprises if the layer is rebuilt from a tarball.
RUN chmod +x ./node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude || true

USER nextjs
EXPOSE 8080

# App Runner pings "/" by default; the home route is statically prerendered
# so this is a cheap healthcheck. ECS health checks also work against /.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:8080/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Force bind to 0.0.0.0 by overriding any host-provided HOSTNAME env at
# runtime, then exec Next's standalone server.
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
