// Local smoke test for agent-runner. Runs the runner directly (no sandbox)
// and prints each NDJSON event as it arrives, so you can confirm:
//   1. The runner boots and parses JOB_JSON.
//   2. The agent SDK + RAG retrieval work end-to-end against live APIs.
//   3. Events stream incrementally (you'll see retrieved/text/proposal lines
//      land progressively, not all at the end).
//
// Requires:
//   - OPENAI_API_KEY and VOYAGE_API_KEY in the environment (or .env.local).
//     (All three modes now run on the OpenAI Agents SDK — pure JS, no native
//     binary needed.)
//   - npm install at the workspace root (already run for normal dev).
//
// Usage:
//   node scripts/smoke-runner.mjs chat
//   node scripts/smoke-runner.mjs write
//   node scripts/smoke-runner.mjs fill
//
// Each mode runs a small canned job. To exercise a custom job, edit the
// CHAT_JOB / WRITE_JOB / FILL_JOB constants below.

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
if (mode !== "chat" && mode !== "write" && mode !== "fill") {
  console.error(`Usage: node scripts/smoke-runner.mjs <chat|write|fill>`);
  process.exit(1);
}

const CHAT_JOB = {
  mode: "chat",
  framework: "cdp",
  messages: [
    {
      role: "user",
      content:
        "What does the CDP questionnaire require when reporting Scope 1 emissions where actual data is not available?",
    },
  ],
  // To exercise the uploaded-PDF RAG path (search_user_docs), uncomment and
  // point at a real index blobUrl produced by /api/ingest, then ask a question
  // only that PDF can answer. The runner fetches the index from the URL exactly
  // as it would inside the sandbox (this script runs on the host with network +
  // VOYAGE_API_KEY). Leaving userDocs unset/empty exercises the unchanged path.
  // userDocs: [
  //   { id: "u_abc12345", name: "Acme Policy.pdf", blobUrl: "https://<store>.public.blob.vercel-storage.com/rag/user/u_abc12345/index.json" },
  // ],
};

const WRITE_JOB = {
  mode: "write",
  framework: "cdp",
  instruction: "Add a short paragraph defining 'Scope 1 emissions' under the CDP questionnaire.",
  outline: [
    { id: "h1", kind: "heading", level: 1, heading: "Emissions methodology" },
    { id: "p1", kind: "paragraph", preview: "This document describes…" },
  ],
};

// Fill mode runs on the OpenAI Agents SDK. This canned job fills the BRSR
// entity-identity question (Section A, Q A.1). With no userDocs / ESG DB it
// exercises the web-search + structured-output path; add userDocs and set
// useEsgDb to exercise those tools (and export the matching env vars).
const FILL_JOB = {
  mode: "fill",
  framework: "brsr",
  useEsgDb: false,
  aiContext: {
    companyName: "Tata Steel Limited",
    reportingYear: 2025,
    businessContext:
      "Tata Steel is an Indian multinational steel-making company headquartered in Mumbai, listed on BSE and NSE.",
  },
  questions: [
    {
      id: "A.1",
      label: "Entity identity & contact",
      description: "Items 1–13 of Section A.I (CIN, addresses, listing, etc.).",
      sectionId: "A.I",
      sectionTitle: "A.I — Details of the Listed Entity",
      questionKind: "fields",
      fields: [
        { id: "cin", label: "Corporate Identity Number (CIN)", kind: "text", required: true },
        { id: "name", label: "Name of the Listed Entity", kind: "text", required: true },
        { id: "website", label: "Website", kind: "text" },
        {
          id: "stockExchange",
          label: "Stock Exchange(s) where listed",
          kind: "select",
          options: ["BSE", "NSE", "BSE & NSE", "Other (specify in remarks)"],
        },
      ],
      existingValues: {},
    },
  ],
};

const job = mode === "chat" ? CHAT_JOB : mode === "write" ? WRITE_JOB : FILL_JOB;

// All modes run on the OpenAI Agents SDK now.
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set (check .env.local)");
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
