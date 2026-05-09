// Helper that boots a Vercel Sandbox, runs the agent runner inside it, and
// streams the runner's stdout (NDJSON) back to the browser as a Response.
//
// This is the single place in the app where we cross the security boundary:
// the dispatcher (running on Vercel) never passes API keys into the sandbox.
// Keys are injected at the network layer via the firewall's transform rule,
// so even if the agent emits process.env to its output it will not leak our
// secrets.
//
// See secure-deployment guidance:
//   https://code.claude.com/docs/en/agent-sdk/secure-deployment

import { Sandbox } from "@vercel/sandbox";

export interface DispatchOptions {
  job: unknown;                 // serialized into JOB_JSON env var
  // Hard cap on sandbox lifetime. Default 10 min on Pro — comfortably
  // within the 800 s function streaming cap, with extra headroom in case
  // the dispatcher ever extends its own timeout. The dispatcher's
  // `finally` and `cancel()` already call sandbox.stop() on stream end
  // and disconnect, so this is a backstop, not the primary kill switch.
  // On Hobby this should be ~90_000 (90 s) — see DEPLOY.md plan tuning.
  timeoutMs?: number;
}

// The Sandbox.create() type is a discriminated union: when source.type is
// "snapshot" you must omit `runtime` (it's pinned by the snapshot); when
// source.type is "tarball" you must include it. Returning the full create-
// params object from one place keeps the branch logic in one spot.
function buildCreateParams(timeout: number, env: Record<string, string>, networkPolicy: unknown) {
  const snapshotId = process.env.AGENT_RUNNER_SNAPSHOT_ID;
  const tarballUrl = process.env.AGENT_RUNNER_TARBALL_URL;

  if (snapshotId) {
    return {
      source: { type: "snapshot" as const, snapshotId },
      resources: { vcpus: 2 },
      timeout,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      networkPolicy: networkPolicy as any,
      env,
    };
  }
  if (tarballUrl) {
    return {
      runtime: "node22" as const,
      source: { type: "tarball" as const, url: tarballUrl },
      resources: { vcpus: 2 },
      timeout,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      networkPolicy: networkPolicy as any,
      env,
    };
  }
  throw new Error(
    "Neither AGENT_RUNNER_SNAPSHOT_ID nor AGENT_RUNNER_TARBALL_URL is set — cannot create sandbox"
  );
}

function getNetworkPolicy() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set");
  if (!voyageKey) throw new Error("VOYAGE_API_KEY is not set");

  // Credential brokering: the firewall TLS-terminates traffic to these two
  // hosts and rewrites the auth header. The sandbox env intentionally has no
  // copy of the keys — the agent cannot exfiltrate what it never sees.
  return {
    allow: {
      "api.anthropic.com": [
        { transform: [{ headers: { "x-api-key": anthropicKey } }] },
      ],
      "api.voyageai.com": [
        { transform: [{ headers: { Authorization: `Bearer ${voyageKey}` } }] },
      ],
    },
  };
}

// Returned to the browser when sandbox creation fails before we have a stream
// to write to. Uses the same NDJSON event shape the runtime stream uses, so
// the existing client parser dispatches it through the normal error path.
function errorResponse(message: string, status = 500): Response {
  const body = JSON.stringify({ event: "error", data: { message } }) + "\n";
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

export async function dispatchToSandbox(opts: DispatchOptions): Promise<Response> {
  const timeout = opts.timeoutMs ?? 600_000;

  // The `transform` rule shape on networkPolicy.allow is documented but the
  // published SDK types don't include it on the public NetworkPolicy union
  // until @vercel/sandbox@beta. We pass the documented shape through and let
  // buildCreateParams cast it for the SDK call.
  const env = {
    NODE_ENV: "production",
    JOB_JSON: JSON.stringify(opts.job),
    // No ANTHROPIC_API_KEY, no VOYAGE_API_KEY — the firewall injects them.
  };

  let sandbox;
  let cmd;
  try {
    sandbox = await Sandbox.create(buildCreateParams(timeout, env, getNetworkPolicy()));
    cmd = await sandbox.runCommand({
      cmd: "npx",
      args: ["tsx", "runner.ts"],
      cwd: "/vercel/sandbox",
      detached: true,
    });
  } catch (err) {
    // Best-effort cleanup if Sandbox.create succeeded but runCommand failed.
    if (sandbox) void sandbox.stop().catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`Sandbox dispatch failed: ${message}`);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Emit a boot event up-front so the client UI can show "starting" while
      // the VM is provisioning (1-3s on tarball, ~150ms on snapshot). This
      // matches the existing event vocabulary: see readNdjson() in
      // src/components/qualitative/AssistantPane.tsx.
      controller.enqueue(
        encoder.encode(
          JSON.stringify({
            event: "sandbox",
            data: { status: "ready", id: sandbox.sandboxId },
          }) + "\n"
        )
      );

      // Buffer for partial lines: a single sandbox stdout chunk can carry
      // multiple JSON lines, or half of one. We forward only complete lines
      // so the client parser never sees a split JSON object.
      let lineBuf = "";

      try {
        for await (const log of cmd.logs()) {
          if (log.stream !== "stdout") continue; // stderr → server logs only
          lineBuf += log.data;
          let nl: number;
          while ((nl = lineBuf.indexOf("\n")) !== -1) {
            controller.enqueue(encoder.encode(lineBuf.slice(0, nl + 1)));
            lineBuf = lineBuf.slice(nl + 1);
          }
        }
        if (lineBuf) controller.enqueue(encoder.encode(lineBuf + "\n"));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              event: "error",
              data: { message: err instanceof Error ? err.message : String(err) },
            }) + "\n"
          )
        );
      } finally {
        controller.close();
        // Fire-and-forget: stop billing as soon as the response is drained.
        void sandbox.stop().catch(() => {});
      }
    },
    cancel() {
      // Browser disconnected mid-stream. Kill the agent and the VM so we
      // aren't paying for tokens or CPU on a conversation nobody's reading.
      void cmd.kill("SIGTERM").catch(() => {});
      void sandbox.stop().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
