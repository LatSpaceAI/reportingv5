// Helper that boots a Vercel Sandbox, runs the agent runner inside it, and
// streams the runner's stdout (NDJSON) back to the browser as a Response.
//
// Currently runs in a degraded security mode — see the SECURITY DOWNGRADE
// comment above getNetworkPolicy() for what's broken and what the recovery
// plan looks like. The original design (and what we should restore) is in
// the secure-deployment guidance:
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

// ⚠️ SECURITY DOWNGRADE (intentional, temporary)
//
// We originally configured this with `transform` rules that injected the
// API keys at the network layer (credential brokering). The Vercel Sandbox
// API rejected those payloads with HTTP 400 in production — most likely
// because credential brokering requires a team-level permission that's
// not yet enabled, even on Pro. See logs from 2026-05-09:
//   POST vercel.com/api/v1/sandboxes → 400
//
// Until brokering is enabled (open a Vercel support ticket), or we move
// to @vercel/sandbox@beta which has the matchers/transforms typed
// properly, we fall back to a plain domain allow-list and pass the API
// keys directly into the sandbox env (see dispatchToSandbox).
//
// The firewall still blocks all egress except these two hosts, so the
// blast radius if the agent misbehaves is limited to those endpoints —
// but the keys do live in process.env inside the VM, which means a
// prompt-injection that gets the model to print env could leak them.
//
// To restore the original boundary later: re-add the `transform` shape
// shown in the commented reference, AND remove ANTHROPIC_API_KEY /
// VOYAGE_API_KEY from the env object in dispatchToSandbox().
//
// Reference: the original (broken) shape was
//   {
//     allow: {
//       "api.anthropic.com": [{ transform: [{ headers: { "x-api-key": anthropicKey } }] }],
//       "api.voyageai.com":  [{ transform: [{ headers: { Authorization: `Bearer ${voyageKey}` } }] }],
//     },
//   }
function getNetworkPolicy() {
  return {
    allow: [
      // Anthropic + Voyage are what the agent actually calls.
      "api.anthropic.com",
      "api.voyageai.com",
      // The sandbox needs to fetch its source tarball from Vercel Blob
      // during boot. The firewall's User-defined mode denies all traffic
      // by default — *including DNS* — so we must explicitly allow the
      // Blob host or the sandbox can never start. Symptom of forgetting:
      // exitCode 6 ("Couldn't resolve host") in the create response.
      // Wildcard covers all public Blob stores; harmless if we don't use
      // others.
      "*.public.blob.vercel-storage.com",
    ],
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

  // ⚠️ See SECURITY DOWNGRADE comment above getNetworkPolicy(). These keys
  // are passed into the sandbox env temporarily because credential brokering
  // is currently rejected by the Sandbox API with HTTP 400. Remove these
  // two env entries (and the key reads) once the firewall transform rules
  // work again.
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set");
  if (!voyageKey) throw new Error("VOYAGE_API_KEY is not set");

  const env = {
    NODE_ENV: "production",
    JOB_JSON: JSON.stringify(opts.job),
    ANTHROPIC_API_KEY: anthropicKey,
    VOYAGE_API_KEY: voyageKey,
  };

  let sandbox;
  let cmd;
  try {
    sandbox = await Sandbox.create(buildCreateParams(timeout, env, getNetworkPolicy()));
    // Use Node's native --experimental-strip-types instead of tsx. tsx's
    // ESM resolution shim was rewriting bare-module imports incorrectly,
    // causing voyageai's package.exports to resolve to a non-existent
    // .jsx file (ERR_MODULE_NOT_FOUND in production logs 2026-05-09).
    // Native Node 22 strip-types just removes type annotations and lets
    // Node's standard resolver handle imports — which is exactly what we
    // want for our use case (no enums, no namespaces, no fancy TS).
    // --no-warnings suppresses Node's "experimental feature" warning that
    // would otherwise spam stderr on every line.
    cmd = await sandbox.runCommand({
      cmd: "node",
      args: ["--experimental-strip-types", "--no-warnings", "runner.ts"],
      cwd: "/vercel/sandbox",
      detached: true,
    });
  } catch (err) {
    // Best-effort cleanup if Sandbox.create succeeded but runCommand failed.
    if (sandbox) void sandbox.stop().catch(() => {});

    // The Sandbox SDK throws APIError instances that carry the full HTTP
    // response (status, json body, text body, sandbox id). We extract those
    // for two reasons: (1) put the rich detail in the server logs so we can
    // diagnose failures from Vercel's function logs, (2) surface enough to
    // the client that the user knows whether to retry vs report.
    type ApiErrorish = Error & {
      response?: { status?: number; statusText?: string };
      json?: unknown;
      text?: string;
      sandboxId?: string;
    };
    const e = err as ApiErrorish;
    const status = e.response?.status;
    const bodyDetail =
      e.json !== undefined ? JSON.stringify(e.json) :
      typeof e.text === "string" && e.text.length > 0 ? e.text :
      undefined;

    // Server-side log — visible in Vercel → Project → Logs.
    console.error("[dispatch] Sandbox.create or runCommand failed", {
      status,
      statusText: e.response?.statusText,
      message: e.message,
      body: bodyDetail,
      sandboxId: e.sandboxId,
    });

    const clientMessage = bodyDetail
      ? `Sandbox dispatch failed (${status ?? "?"}): ${bodyDetail}`
      : `Sandbox dispatch failed: ${e.message ?? String(err)}`;
    return errorResponse(clientMessage);
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
      let stderrBuf = "";
      let stdoutBytes = 0;

      try {
        for await (const log of cmd.logs()) {
          if (log.stream === "stderr") {
            // Buffer stderr server-side. We don't push it to the browser
            // (would corrupt NDJSON) but if the runner crashes before
            // emitting anything to stdout, stderr is the only place we
            // learn why. Logged below in the finally block.
            stderrBuf += log.data;
            continue;
          }
          stdoutBytes += log.data.length;
          lineBuf += log.data;
          let nl: number;
          while ((nl = lineBuf.indexOf("\n")) !== -1) {
            controller.enqueue(encoder.encode(lineBuf.slice(0, nl + 1)));
            lineBuf = lineBuf.slice(nl + 1);
          }
        }
        if (lineBuf) controller.enqueue(encoder.encode(lineBuf + "\n"));

        // The logs() generator returned, meaning the runner exited. Wait
        // for the exit code (cmd is detached so we have to ask). Then,
        // if it crashed before printing anything useful, surface the
        // failure to the browser so the UI doesn't just hang.
        const finished = await cmd.wait();
        const exitCode = finished.exitCode;
        console.log("[dispatch] runner exit", {
          exitCode,
          stdoutBytes,
          stderrBytes: stderrBuf.length,
          stderrTail: stderrBuf.slice(-2000),
        });
        if (exitCode !== 0 && stdoutBytes === 0) {
          // Runner died before emitting any NDJSON. Tell the browser.
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                event: "error",
                data: {
                  message: `Runner exited ${exitCode} with no output. Stderr tail: ${
                    stderrBuf.slice(-500) || "(empty)"
                  }`,
                },
              }) + "\n"
            )
          );
        }
      } catch (err) {
        console.error("[dispatch] log stream / wait failed", {
          message: err instanceof Error ? err.message : String(err),
          stderrTail: stderrBuf.slice(-2000),
        });
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
