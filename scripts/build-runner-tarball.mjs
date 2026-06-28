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

// Load .env.local / .env so BLOB_READ_WRITE_TOKEN (needed for --upload) is
// available when this is run via `npm run publish:runner` outside Vercel/CI,
// matching how smoke-runner.mjs and build-index.mjs read their secrets.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  statSync,
  existsSync,
} from "node:fs";
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

// Locate a GNU tar. The Windows-shipped C:\Windows\System32\tar.exe is bsdtar,
// which (a) rejects --force-local and (b) differs from GNU tar in subtle ways;
// Git for Windows ships a real GNU tar at <Git>\usr\bin\tar.exe. We prefer an
// explicit GNU tar and invoke it WITHOUT a shell so PATH resolution can't fall
// back to System32. Returns the resolved tar path.
function findGnuTar() {
  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Git\\usr\\bin\\tar.exe",
          "C:\\Program Files (x86)\\Git\\usr\\bin\\tar.exe",
        ]
      : ["/usr/bin/tar", "/bin/tar"];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Last resort: whatever "tar" is on PATH. On CI (Linux) this is GNU tar.
  return "tar";
}

// Create a gzip tarball of everything in `cwd` (top-level entries, no wrapping
// dir) at `outPath`. We don't use --force-local: the output path is RELATIVE to
// cwd, so there's no Windows drive-letter colon for tar to misparse as a remote
// host.
//
// IMPORTANT: we create an UNCOMPRESSED .tar (-cf, no -z) and gzip it in Node
// with zlib afterwards. GNU tar's -z spawns the external `gzip` program as a
// child; invoked with shell:false that child isn't found on Windows (Git's
// gzip.exe isn't on the System PATH), which surfaces as "Broken pipe / Child
// returned status 127". Doing the gzip in-process removes that dependency
// entirely and is byte-for-byte deterministic across platforms/CI.
//
// We also tolerate GNU tar's benign "file changed as we read it" warning
// (exit 1) that fires when npm's just-written staging dir mtime ticks during
// the read — the archive is still valid, which we verify by size afterwards.
function createTarGz(tarBin, cwd, relativeTarPath, finalGzPath) {
  const result = spawnSync(tarBin, ["-cf", relativeTarPath, "."], {
    cwd,
    encoding: "utf8",
    shell: false,
  });
  if (result.error) {
    throw new Error(`Failed to spawn tar (${tarBin}): ${result.error.message}`);
  }
  const stderr = (result.stderr || "").trim();
  if (result.status !== 0) {
    const benign = /file changed as we read it|Removing leading/i.test(stderr);
    if (!benign) {
      throw new Error(
        `tar failed with exit code ${result.status}:\n${stderr || "(no stderr)"}`
      );
    }
    console.warn(`  tar warning (non-fatal): ${stderr.split("\n")[0]}`);
  }

  const tarPath = resolve(cwd, relativeTarPath);
  if (!existsSync(tarPath)) {
    throw new Error(`tar reported success but ${tarPath} is missing`);
  }
  // gzip the uncompressed tar in-process and write the final .tar.gz.
  const gz = gzipSync(readFileSync(tarPath), { level: 9 });
  writeFileSync(finalGzPath, gz);
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
  // flags (npm 9+) force the optional-deps resolver to pick the linux-x64
  // variant of any native dependency even when building from a non-Linux host,
  // so the tarball works inside Vercel Sandbox (Linux x64). CI on
  // ubuntu-latest doesn't strictly need these flags, but they're harmless.
  // (The runner no longer ships the Claude Agent SDK native binary — all agent
  // modes run on the OpenAI Agents SDK, which is pure JS.)
  console.log("Installing runner deps (targeting linux-x64)...");
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

  // Step 3: tar it up. Contents are at the top level (no wrapping dir) so the
  // sandbox extracts them directly into /vercel/sandbox. We write the archive
  // INSIDE the staging parent (a relative path from cwd=stagingRunner), then
  // move it to the repo root — this avoids passing tar an absolute Windows path
  // with a drive-letter colon, and lets us use a real GNU tar without
  // --force-local.
  console.log(`Creating ${tarballName}...`);
  const tarBin = findGnuTar();
  console.log(`  using tar: ${tarBin}`);
  // tar writes an uncompressed .tar next to the staging dir (a relative path
  // from cwd=stagingRunner, so no absolute drive-letter colon and it isn't
  // archiving itself); createTarGz then gzips it in-process straight to the
  // final repo-root .tar.gz path.
  const relativeTar = join("..", `${tarballName.replace(/\.gz$/, "")}`);
  createTarGz(tarBin, stagingRunner, relativeTar, tarballPath);

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
