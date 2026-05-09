// Entry point for the agent runner that runs inside Vercel Sandbox.
//
// Lifecycle:
//   1. Dispatcher route (on Vercel) creates a Sandbox, sets JOB_JSON in the
//      sandbox env, and calls `node runner.ts` (via tsx).
//   2. We parse JOB_JSON, dispatch to the chat or write handler.
//   3. The handler runs `query(...)` from the Claude Agent SDK, which spawns
//      the bundled CLI binary as a subprocess inside the sandbox.
//   4. Each agent event (text delta, tool use, retrieved sources, proposal,
//      done, error) is written to stdout as a single NDJSON line.
//   5. The sandbox SDK's cmd.logs() forwards those lines to the dispatcher,
//      which re-emits them to the browser unchanged.
//
// This file MUST NOT use console.log — Node may batch console output through
// libuv writev() calls in ways that defeat line-streaming. Use process.stdout
// directly so each event is flushed immediately.

import { handleChat } from "./modes/chat.ts";
import { handleWrite } from "./modes/write.ts";
import type { EmitFn, ChatJob, WriteJob } from "./modes/types.ts";

const emit: EmitFn = (event, data) => {
  process.stdout.write(JSON.stringify({ event, data }) + "\n");
};

function fail(message: string): never {
  emit("error", { message });
  process.exit(1);
}

async function main(): Promise<void> {
  const raw = process.env.JOB_JSON;
  if (!raw) fail("JOB_JSON env var is missing");

  let job: unknown;
  try {
    job = JSON.parse(raw);
  } catch (err) {
    fail(`JOB_JSON is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!job || typeof job !== "object" || !("mode" in job)) {
    fail("JOB_JSON must be an object with a 'mode' field");
  }
  const mode = (job as { mode: unknown }).mode;

  if (mode === "chat") {
    await handleChat(job as ChatJob, emit);
  } else if (mode === "write") {
    await handleWrite(job as WriteJob, emit);
  } else {
    fail(`Unknown job mode: ${String(mode)}`);
  }
}

main().then(
  () => {
    // Successful completion is signalled by the `done` event the handler
    // already emitted; just exit 0.
    process.exit(0);
  },
  (err) => {
    emit("error", { message: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  }
);
