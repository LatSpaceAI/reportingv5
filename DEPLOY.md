# Deployment runbook

This app runs as **two coupled deployments**:

1. **Vercel** hosts the Next.js app (UI, exports, dispatcher routes).
2. **Vercel Sandbox** hosts the Claude Agent SDK in an isolated Firecracker microVM, started fresh on every `/api/chat` and `/api/write` request.

The dispatcher routes proxy NDJSON between the browser and the sandbox; the sandbox never sees API keys (the firewall injects them at the network layer).

See [Hosting the Agent SDK](https://code.claude.com/docs/en/agent-sdk/hosting) and [Securely deploying AI agents](https://code.claude.com/docs/en/agent-sdk/secure-deployment) for the principles this design implements.

---

## One-time setup

### 1. Vercel project

- `vercel link` from the repo root.
- This codebase is currently tuned for the **Hobby plan** (verification / first-look deploy). The trade-offs are documented in [§ Plan tuning](#plan-tuning) below — read that section before promoting any user-facing flow that needs longer runs.
- Confirm **credential brokering** is enabled on your Vercel team. The firewall uses `transform: [{ headers: ... }]` rules to inject API keys; per the [firewall docs](https://vercel.com/docs/vercel-sandbox/concepts/firewall#credentials-brokering) this requires an account permission. If it's silently no-opping, contact Vercel.

### 2. Environment variables on the Vercel project

| Variable | Value | Where it's used |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Dispatcher route only — passed to the sandbox firewall as a `transform` rule. Never enters the sandbox env. |
| `VOYAGE_API_KEY` | Your Voyage API key | Same pattern as Anthropic. |
| `AGENT_RUNNER_TARBALL_URL` | URL of the published runner tarball (Vercel Blob) | `Sandbox.create()` source. |
| `AGENT_RUNNER_SNAPSHOT_ID` | (optional) Sandbox snapshot ID | Overrides `AGENT_RUNNER_TARBALL_URL` if set. Faster cold start (~150 ms vs 1-3 s). |

### 3. CI secret

Set `BLOB_READ_WRITE_TOKEN` in the GitHub repository's secrets so the [publish workflow](.github/workflows/publish-agent-runner.yml) can upload the tarball. Create the token under **Vercel → Storage → Blob → Tokens**.

### 4. Publish the first tarball

Either:

- **Locally:**
  ```sh
  npm install --no-save @vercel/blob
  BLOB_READ_WRITE_TOKEN=... npm run publish:runner
  ```
  Copy the URL it prints into Vercel's `AGENT_RUNNER_TARBALL_URL` env var.

- **Via CI:** push to `main` (with the agent-runner workflow secrets set) or click "Run workflow" on the GitHub Actions tab.

---

## Rebuilding the runner tarball

The runner only needs to be rebuilt when something under `agent-runner/` changes (the agent code, the RAG index, or the runner's deps). The Next app deploys independently — a Vercel deploy doesn't touch the tarball.

The CI workflow at [.github/workflows/publish-agent-runner.yml](.github/workflows/publish-agent-runner.yml) handles this automatically on push to `main`. To force a rebuild without a code change, use **Run workflow** on the workflow's GitHub Actions page.

Manually:

```sh
npm run build:runner          # builds + reports path, no upload
npm run publish:runner        # builds + uploads to Vercel Blob
```

The build script forces `--os=linux --cpu=x64 --libc=glibc` so the Linux-only Claude Agent SDK binary lands in the tarball even when running on a Mac/Windows dev machine.

---

## Local development

```sh
# Install workspace deps (root + agent-runner)
npm install

# Run the Next app
npm run dev
```

To exercise the agent without spinning up a sandbox, use the smoke tests:

```sh
# Requires ANTHROPIC_API_KEY and VOYAGE_API_KEY in .env.local
npm run smoke:chat            # canned chat job, prints NDJSON timeline
npm run smoke:write           # canned write job
```

Each line of output is `[elapsed] event payload`. If `text` events arrive incrementally, the streaming contract is healthy.

---

## Production smoke tests (do these before announcing the deploy)

### Test 1 — Build is clean

```sh
npx tsc --noEmit -p tsconfig.json   # main app type-checks
cd agent-runner && npx tsc --noEmit # runner type-checks
npx next build                      # both routes show 0 B (dispatchers)
```

### Test 2 — Tarball contents

```sh
tar -tzf agent-runner-*.tar.gz | grep -E 'runner.ts|linux-x64/claude'
```

Expected output:
```
./node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude
./runner.ts
```

### Test 3 — Security boundary (DECISIVE TEST)

After the first preview deploy, get a sandbox ID from the Vercel logs of a real `/api/chat` request, then connect to that sandbox interactively (you'll have to be quick — sandboxes stop right after the request finishes; do this against a long write request or temporarily extend `timeoutMs` in the dispatcher):

```sh
sandbox connect sb_xxxxxxxxx
# inside the sandbox:
curl -s https://example.com    # MUST fail (firewall blocked)
curl -s -H 'x-api-key: WRONG' https://api.anthropic.com/v1/models | head -5
# MUST succeed (the firewall transform rule rewrites the header to the
# real key — proving the agent never needs to know the key)
echo "$ANTHROPIC_API_KEY"      # MUST be empty (key never enters sandbox env)
```

If any of these fail, **do not roll out**. Investigate before continuing.

### Test 4 — Streaming is live, not buffered

Open `/api/write` from the deployed UI with a request that triggers `search_guidance` 2-3 times (any non-trivial regulatory question). In the browser DevTools Network tab:

- Response should be `200 OK` with `Content-Type: application/x-ndjson`, `Transfer-Encoding: chunked`.
- The Response → Preview/EventStream view should show events arriving over time, not all at once at the end.
- `retrieved` events should appear **before** the `proposal` event.

If chunks arrive all together, see [SSE Addendum in the deployment plan](#) — most likely the runner is using `console.log` instead of `process.stdout.write`, or there's a buffering layer in the dispatcher's `cmd.logs()` consumption.

### Test 5 — Disconnect cleanup

Open `/api/chat` from the UI, kill the network mid-stream (DevTools → Throttling → Offline). Within ~10 seconds, check the Vercel Sandbox dashboard: the sandbox for that request should show status `stopping` or `stopped`. Sandboxes piling up after disconnects means the `cancel()` handler in [src/lib/dispatcher/sandbox.ts](src/lib/dispatcher/sandbox.ts) isn't propagating.

---

## Rollback

The previous Railway-based deployment is preserved on the commit before the Vercel-Sandbox refactor. To roll back:

1. `git log --oneline | grep "before vercel sandbox"` (or whatever your cutover commit message uses).
2. On the Railway side: redeploy that commit.
3. On the Vercel side: pause the project (Project Settings → Pause).
4. Point production DNS back at the Railway URL.

The current `Dockerfile` is **deprecated** and will not build on the post-refactor commit — agent-runner/ and the Vercel Sandbox dispatcher routes don't fit the container architecture.

---

## Cost expectations (Pro plan)

Per request (Vercel Sandbox infra only — Anthropic/Voyage tokens are separate and dwarf this):

| Component | Cost |
|---|---|
| Active CPU (~10 s on 2 vCPU) | $0.0007 |
| Provisioned memory (4 GB-min) | $0.0014 |
| Sandbox creation | $0.0000006 |
| **Total per request** | **~$0.002** |

The dominant levers:
- **Snapshot, not tarball**, in production. Cold start drops from 1-3 s to ~150 ms; per-request cost is unchanged but UX improves dramatically.
- **`sandbox.stop()` in `finally` and on `cancel()`** — the dispatcher already does this; verify in test 5.
- **No keep-warm**: sandboxes are ephemeral by design. Don't try to reuse them.

## Plan tuning

This codebase ships with knobs set for the Vercel Hobby plan. Hobby's ceilings are tighter than Pro in three places that matter:

| Limit | Hobby | Pro/Enterprise |
|---|---|---|
| Function `maxDuration` (streaming response cap) | **60 s** | 800 s |
| Sandbox max runtime per VM | 45 min | 5 hr |
| Sandbox CPU budget | **5 hr/month total** | metered, no hard cap |
| Concurrent sandboxes | 10 | 2,000 |

The dispatcher holds the response stream open for the entire agent run. So **`maxDuration` is also the hard ceiling on how long the model has to think before the user sees a truncated answer**. To stay safely inside 60 s, the runner caps `maxTurns` at 4 (was 8 in earlier drafts). One turn = one model call + the tool calls it triggers; with Opus and a regulatory question, each turn typically takes 8–20 s. Four turns is enough for "search guidance once or twice, retrieve, then answer / propose" — the load-bearing flow.

**The 5-hour CPU budget is the cliff.** Vercel only meters time the sandbox spends actively on CPU (waiting on Anthropic doesn't count), so a typical `/api/write` is 5–15 s of billable CPU. That gives ~1,500–3,500 requests per month before sandbox creation pauses until the next billing cycle. Watch the [Usage dashboard](https://vercel.com/dashboard) — when you cross ~80%, plan to upgrade.

### Promoting to Pro

When you upgrade, three knobs flip back to their original values. Search the codebase for `Hobby` to find them all:

| File | Change |
|---|---|
| [vercel.json](vercel.json) | `maxDuration: 60` → `800` |
| [src/app/api/chat/route.ts](src/app/api/chat/route.ts) and [src/app/api/write/route.ts](src/app/api/write/route.ts) | `export const maxDuration = 60` → `800` |
| [src/lib/dispatcher/sandbox.ts](src/lib/dispatcher/sandbox.ts) | Default `timeoutMs` `90_000` → `600_000` |
| [agent-runner/modes/chat.ts](agent-runner/modes/chat.ts) and [agent-runner/modes/write.ts](agent-runner/modes/write.ts) | `maxTurns: 4` → `8` |

After Pro, also consider switching `AGENT_RUNNER_TARBALL_URL` to `AGENT_RUNNER_SNAPSHOT_ID` for faster cold starts (~150 ms vs 1–3 s).

### What to expect on Hobby

- **Most chat questions answer fine.** Single-question, short-context chat usually finishes in 15–30 s.
- **Write tasks with multiple `search_guidance` calls are tight.** Watch DevTools → Network: if you see the function close at 60 s with `done` never arriving, the agent ran out of time. Drop `maxTurns` further (to 3) or split the user's instruction.
- **Complex compound questions may hit `maxTurns` before answering.** This is preferable to silent truncation.
- **CPU budget runs out faster than you expect** if you have many users hitting it during testing. ~50 active users × 30 requests/month each = 1,500 requests, right at the budget edge.

---

## Architecture in one paragraph

The browser POSTs to `/api/chat` or `/api/write` on Vercel. The dispatcher route validates the request, calls `Sandbox.create()` with a `deny-by-default` firewall + `allow` rules for `api.anthropic.com` and `api.voyageai.com` that include `transform` rules injecting the API keys at the network layer. The dispatcher passes the request as `JOB_JSON` env var into the sandbox and runs `npx tsx runner.ts`. The runner reads the env var, calls `query(...)` from the Claude Agent SDK (which spawns its own bundled CLI binary as a subprocess), and writes one NDJSON event per line to stdout. The dispatcher reads the sandbox's stdout via `cmd.logs()`, line-aligns it (so partial JSON objects never reach the client), and forwards each line into a `Response` ReadableStream that the browser consumes via the existing parser at [AssistantPane.tsx:1051](src/components/qualitative/AssistantPane.tsx:1051). On stream completion or client disconnect, the dispatcher calls `sandbox.stop()`. The sandbox env never contains any API keys; even an exfil attempt by the agent has no key to exfil.
