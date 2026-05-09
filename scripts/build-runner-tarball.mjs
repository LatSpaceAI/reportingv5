// Builds the agent-runner tarball that ships into Vercel Sandbox.
//
// The tarball is mounted at /vercel/sandbox inside the sandbox VM, so the
// archive's top-level entries must be the runner files themselves
// (runner.ts, package.json, lib/, modes/, data/, node_modules/) — no
// wrapping directory.
//
// The Claude Agent SDK ships a ~250 MB native Linux x64 binary as an
// optional dep. npm only installs the variant matching the build host's
// platform. To produce a tarball that works inside Vercel Sandbox (Linux
// x64) FROM A NON-LINUX HOST, we set npm_config_target_platform=linux and
// npm_config_target_arch=x64 before the install, which forces npm to pick
// the linux-x64 optional dep. (CI on ubuntu-latest gets this for free.)
//
// Usage:
//   node scripts/build-runner-tarball.mjs              # build only
//   node scripts/build-runner-tarball.mjs --upload     # also upload to Blob
//
// Output: agent-runner-<sha>.tar.gz in the repo root.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const RUNNER_DIR = join(REPO_ROOT, "agent-runner");

const args = new Set(process.argv.slice(2));
const SHOULD_UPLOAD = args.has("--upload");

function run(cmd, cmdArgs, cwd) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${cmdArgs.join(" ")} failed with exit code ${result.status}`);
  }
}

function getCommitSha() {
  try {
    const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: REPO_ROOT,
      shell: process.platform === "win32",
      encoding: "utf8",
    });
    if (result.status === 0) return result.stdout.trim();
  } catch {}
  return "dev";
}

console.log("==> Building agent-runner tarball");

const sha = getCommitSha();
const tarballName = `agent-runner-${sha}.tar.gz`;
const tarballPath = join(REPO_ROOT, tarballName);

// Step 1: copy the runner tree into a staging dir. We use cpSync with a
// filter so we drop the things we don't want in the tarball (any existing
// node_modules, tsbuildinfo, the indexing-script checkpoint files).
const stagingParent = mkdtempSync(join(tmpdir(), "agent-runner-build-"));
const stagingRunner = join(stagingParent, "agent-runner");
console.log(`Staging at ${stagingRunner}`);

try {
  cpSync(RUNNER_DIR, stagingRunner, {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(RUNNER_DIR.length + 1).replace(/\\/g, "/");
      if (!rel) return true;
      // Skip pre-existing node_modules — we'll install fresh in staging.
      if (rel === "node_modules" || rel.startsWith("node_modules/")) return false;
      // Skip Next.js build leftovers that npm install can leave behind in
      // the workspace (Next's postinstall touches .next/trace if NEXT_TELEMETRY
      // is enabled; the runner doesn't depend on Next, but the trace dir
      // can sneak in via the workspace install).
      if (rel === ".next" || rel.startsWith(".next/")) return false;
      // Skip the indexing script's transient checkpoint files.
      if (/\.contextualized\.json$/.test(rel)) return false;
      if (/-build\.log$/.test(rel)) return false;
      // Skip TypeScript incremental build artifacts.
      if (/\.tsbuildinfo$/.test(rel)) return false;
      return true;
    },
  });

  // Step 2: install runner deps against staging copy. The --os/--cpu/--libc
  // flags (npm 9+) force the optional-deps resolver to pick linux-x64 even
  // when running on a non-Linux host — that's the only way to get the right
  // native Claude Agent SDK binary into the tarball from a Mac/Windows dev.
  // CI on ubuntu-latest doesn't strictly need these flags, but they're
  // harmless there too.
  console.log("Installing runner deps (forcing linux-x64 optional binaries)...");
  run(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--omit=dev",
      "--no-package-lock",
      "--os=linux",
      "--cpu=x64",
      "--libc=glibc",
      "--include=optional",
    ],
    stagingRunner
  );

  // Sanity: confirm the linux-x64 binary actually got installed.
  const linuxBinary = join(
    stagingRunner,
    "node_modules",
    "@anthropic-ai",
    "claude-agent-sdk-linux-x64",
    "claude"
  );
  if (!existsSync(linuxBinary)) {
    throw new Error(
      `Expected linux-x64 binary at ${linuxBinary} but it's missing — npm did not pick the linux variant. Check npm_config_target_platform and the @anthropic-ai/claude-agent-sdk-linux-x64 optionalDependency.`
    );
  }
  console.log(`Found linux-x64 binary at ${linuxBinary}`);

  // Step 3: tar it up. Contents are at the top level (no wrapping dir) so
  // the sandbox extracts them directly into /vercel/sandbox. We invoke tar
  // with cwd=stagingRunner and a relative output path: passing an absolute
  // Windows path with a drive letter (e.g. C:\foo) breaks GNU tar, which
  // parses it as a remote machine path.
  console.log(`Creating ${tarballName}...`);
  // GNU tar's --force-local flag tells it to treat colons as file-name
  // characters rather than remote-host separators — required on Windows
  // where bsdtar/gnutar will otherwise see "C:\path" as host=C path=\path.
  run(
    "tar",
    ["--force-local", "-czf", tarballPath, "."],
    stagingRunner
  );

  const stats = statSync(tarballPath);
  const sizeMb = (stats.size / 1024 / 1024).toFixed(1);
  const tarballSha = createHash("sha256").update(readFileSync(tarballPath)).digest("hex").slice(0, 12);
  console.log(`==> Built ${tarballName} (${sizeMb} MB, sha256:${tarballSha})`);
  console.log(`Path: ${tarballPath}`);

  if (SHOULD_UPLOAD) {
    console.log("==> Uploading to Vercel Blob...");
    const { put } = await import("@vercel/blob").catch(() => {
      throw new Error(
        "@vercel/blob is not installed. Run: npm install --no-save @vercel/blob, then retry."
      );
    });
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("BLOB_READ_WRITE_TOKEN is not set");
    }
    const tarballBytes = readFileSync(tarballPath);
    const blob = await put(tarballName, tarballBytes, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/gzip",
    });
    console.log(`==> Uploaded: ${blob.url}`);
    console.log("");
    console.log("Set this in your Vercel project env:");
    console.log(`  AGENT_RUNNER_TARBALL_URL=${blob.url}`);
  }
} finally {
  try {
    rmSync(stagingParent, { recursive: true, force: true });
  } catch (err) {
    console.warn(`Warning: could not clean up ${stagingParent}: ${err.message}`);
  }
}
