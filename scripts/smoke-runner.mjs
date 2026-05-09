// Local smoke test for agent-runner. Runs the runner directly (no sandbox)
// and prints each NDJSON event as it arrives, so you can confirm:
//   1. The runner boots and parses JOB_JSON.
//   2. The agent SDK + RAG retrieval work end-to-end against live APIs.
//   3. Events stream incrementally (you'll see retrieved/text/proposal lines
//      land progressively, not all at the end).
//
// Requires:
//   - ANTHROPIC_API_KEY and VOYAGE_API_KEY in the environment (or .env.local).
//   - npm install at the workspace root (already run for normal dev).
//   - The native Claude Agent SDK binary for your host platform — npm
//     install hoists this automatically; it's NOT the linux-x64 binary that
//     the published tarball ships.
//
// Usage:
//   node scripts/smoke-runner.mjs chat
//   node scripts/smoke-runner.mjs write
//
// Each mode runs a small canned job. To exercise a custom job, edit the
// CHAT_JOB / WRITE_JOB constants below.

import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const RUNNER_DIR = join(REPO_ROOT, "agent-runner");

// Prefer .env.local then .env, matching Next conventions.
loadEnv({ path: join(REPO_ROOT, ".env.local") });
loadEnv({ path: join(REPO_ROOT, ".env") });

const mode = process.argv[2];
if (mode !== "chat" && mode !== "write") {
  console.error(`Usage: node scripts/smoke-runner.mjs <chat|write>`);
  process.exit(1);
}

const CHAT_JOB = {
  mode: "chat",
  framework: "cbam",
  messages: [
    {
      role: "user",
      content:
        "What does the CBAM regulation say about default values for embedded emissions when actual data is not available?",
    },
  ],
};

const WRITE_JOB = {
  mode: "write",
  framework: "cbam",
  instruction: "Add a short paragraph defining 'embedded emissions' under CBAM.",
  outline: [
    { id: "h1", kind: "heading", level: 1, heading: "Monitoring methodology" },
    { id: "p1", kind: "paragraph", preview: "This document describes…" },
  ],
};

const job = mode === "chat" ? CHAT_JOB : WRITE_JOB;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set (check .env.local)");
  process.exit(1);
}
if (!process.env.VOYAGE_API_KEY) {
  console.error("VOYAGE_API_KEY is not set (check .env.local)");
  process.exit(1);
}

console.log(`==> Smoke test: mode=${mode}`);
console.log(`Spawning: node --experimental-strip-types runner.ts (in ${RUNNER_DIR})`);

const t0 = Date.now();
const child = spawn(
  process.platform === "win32" ? "node.exe" : "node",
  ["--experimental-strip-types", "--no-warnings", "runner.ts"],
  {
    cwd: RUNNER_DIR,
    env: {
      ...process.env,
      JOB_JSON: JSON.stringify(job),
    },
    stdio: ["ignore", "pipe", "inherit"],
  }
);

let buf = "";
const eventCounts = new Map();

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2).padStart(6);
    try {
      const ev = JSON.parse(line);
      eventCounts.set(ev.event, (eventCounts.get(ev.event) ?? 0) + 1);
      // For text deltas keep the output compact — print only first 60 chars.
      const data =
        ev.event === "text" && typeof ev.data?.text === "string"
          ? { text: ev.data.text.slice(0, 60) + (ev.data.text.length > 60 ? "…" : "") }
          : ev.data;
      console.log(`[${elapsed}s] ${ev.event.padEnd(10)} ${JSON.stringify(data)}`);
    } catch {
      console.log(`[${elapsed}s] (unparseable line) ${line}`);
    }
  }
});

child.on("exit", (code) => {
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`\n==> Runner exited code=${code} after ${elapsed}s`);
  console.log("Event counts:");
  for (const [k, v] of [...eventCounts.entries()].sort()) {
    console.log(`  ${k}: ${v}`);
  }
  process.exit(code ?? 0);
});
