#!/usr/bin/env node

import fs from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const stateFileName = ".hai-harness.json";
const defaultManifestUrl = "https://api.github.com/repos/ClaudiusMa/HAI-Harness/releases/latest";
const checkIntervalMs = 7 * 24 * 60 * 60 * 1000;
const maxResponseBytes = 16 * 1024;
const requestTimeoutMs = 4_000;
const runFile = promisify(execFile);
// The receipt sits beside this script's Agents/ folder (.hai/ in a project), so
// the check works from any working directory.
const harnessRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

main().catch(() => {
  // Update discovery must never block normal project work.
});

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const statePath = path.join(options.target, stateFileName);
  const state = await readState(statePath);

  if (options.disable || options.enable) {
    state.checkEnabled = options.enable;
    await writeState(statePath, state);
    console.log(`HAI-Harness update checks ${state.checkEnabled ? "enabled" : "disabled"}.`);
    return;
  }

  const cachePath = options.cache ? path.resolve(options.cache) : await resolveCachePath(options.target);
  const cache = await readCache(cachePath);
  if (!state.checkEnabled) {
    if (options.status) console.log("Update status: disabled");
    return;
  }

  const now = new Date(options.now ?? Date.now());
  if (Number.isNaN(now.getTime())) throw new Error("Invalid --now value.");
  const lastChecked = Date.parse(cache.lastCheckedAt);
  const due = !Number.isFinite(lastChecked) || now.getTime() - lastChecked >= checkIntervalMs;
  let result = cachedResult(cache, state.installedVersion);

  if (due || options.force) {
    result = await checkManifest(options.manifest, state.channel, state.installedVersion);
    cache.lastCheckedAt = now.toISOString();
    cache.lastCheckStatus = result.status;
    if (result.version) cache.latestVersion = result.version;
    await writeState(cachePath, cache);
  }

  if (options.status) {
    printStatus(state.installedVersion, result);
    return;
  }

  if (result.status !== "available" || cache.lastNotifiedVersion === result.version) return;
  console.log(`HAI-Harness ${result.version} is available (installed: ${state.installedVersion}).`);
  console.log("Review the update first:");
  console.log("  npx github:ClaudiusMa/HAI-Harness update --dry-run");
  if (result.releaseNotesUrl) console.log(`Release notes: ${result.releaseNotesUrl}`);
  cache.lastNotifiedVersion = result.version;
  await writeState(cachePath, cache);
}

function parseOptions(args) {
  const options = {
    target: harnessRoot,
    status: false,
    force: false,
    disable: false,
    enable: false,
    manifest: defaultManifestUrl,
    cache: undefined,
    now: undefined
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (["--status", "--force", "--disable", "--enable"].includes(arg)) {
      options[arg.slice(2)] = true;
      continue;
    }
    if (["--target", "--manifest", "--cache", "--now"].includes(arg)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
      options[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option "${arg}".`);
  }
  if (options.disable && options.enable) throw new Error("Choose either --disable or --enable.");
  options.target = path.resolve(options.target);
  return options;
}

async function readState(statePath) {
  const parsed = JSON.parse(await fs.readFile(statePath, "utf8"));
  if (parsed.schemaVersion !== 1 || !isVersion(parsed.installedVersion)) {
    throw new Error("Invalid HAI-Harness installed-state receipt.");
  }
  // Keep the receipt's other fields (core file hashes, block state) on rewrite.
  return {
    ...parsed,
    schemaVersion: 1,
    installedVersion: parsed.installedVersion,
    channel: typeof parsed.channel === "string" ? parsed.channel : "stable",
    checkEnabled: parsed.checkEnabled !== false
  };
}

async function readCache(cachePath) {
  const parsed = await fs.readFile(cachePath, "utf8").then(JSON.parse).catch(() => ({}));
  return {
    schemaVersion: 1,
    lastCheckedAt: typeof parsed.lastCheckedAt === "string" ? parsed.lastCheckedAt : null,
    lastCheckStatus: typeof parsed.lastCheckStatus === "string" ? parsed.lastCheckStatus : "unknown",
    latestVersion: isVersion(parsed.latestVersion) ? parsed.latestVersion : null,
    lastNotifiedVersion: isVersion(parsed.lastNotifiedVersion) ? parsed.lastNotifiedVersion : null
  };
}

async function writeState(statePath, state) {
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporaryPath, statePath);
}

async function resolveCachePath(target) {
  try {
    const { stdout } = await runFile("git", ["rev-parse", "--git-path", "hai-harness/update-beacon.json"], {
      cwd: target,
      timeout: 2_000,
      maxBuffer: 8 * 1024
    });
    return path.resolve(target, stdout.trim());
  } catch {
    const key = createHash("sha256").update(path.resolve(target)).digest("hex").slice(0, 24);
    return path.join(userCacheRoot(), `${key}.json`);
  }
}

function userCacheRoot() {
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Caches", "hai-harness");
  if (process.platform === "win32" && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "hai-harness");
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "hai-harness");
}

function cachedResult(cache, installedVersion) {
  if (cache.lastCheckStatus === "available" && cache.latestVersion) {
    if (compareVersions(cache.latestVersion, installedVersion) <= 0) {
      return { status: "current", version: cache.latestVersion };
    }
    return { status: "available", version: cache.latestVersion };
  }
  if (cache.lastCheckStatus === "current") return { status: "current", version: cache.latestVersion };
  return { status: "unknown" };
}

async function checkManifest(source, channel, installedVersion) {
  try {
    const raw = source.startsWith("https://")
      ? await readHttps(source)
      : await readBoundedFile(path.resolve(source));
    const manifest = JSON.parse(raw);
    if (channel !== "stable" || manifest.draft !== false || manifest.prerelease !== false) {
      throw new Error("Invalid release manifest.");
    }
    const version = releaseVersion(manifest.tag_name);
    if (!version) throw new Error("Invalid release tag.");
    return {
      status: compareVersions(version, installedVersion) > 0 ? "available" : "current",
      version,
      releaseNotesUrl: safeHttpsUrl(manifest.html_url) ? manifest.html_url : undefined
    };
  } catch {
    return { status: "offline" };
  }
}

async function readBoundedFile(filePath) {
  const stats = await fs.stat(filePath);
  if (!stats.isFile() || stats.size > maxResponseBytes) throw new Error("Release manifest is too large.");
  return fs.readFile(filePath, "utf8");
}

function readHttps(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "HAI-Harness-Update-Beacon" }
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Release manifest returned HTTP ${response.statusCode}.`));
        return;
      }
      let size = 0;
      const chunks = [];
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > maxResponseBytes) {
          request.destroy(new Error("Release manifest is too large."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      response.on("error", reject);
    });
    request.setTimeout(requestTimeoutMs, () => request.destroy(new Error("Release manifest request timed out.")));
    request.on("error", reject);
  });
}

function printStatus(installedVersion, result) {
  if (result.status === "available") {
    console.log(`Update status: update available (${installedVersion} -> ${result.version})`);
    return;
  }
  if (result.status === "current") {
    console.log(`Update status: current (${installedVersion})`);
    return;
  }
  console.log("Update status: unknown/offline");
}

function isVersion(value) {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
}

function releaseVersion(tag) {
  if (typeof tag !== "string" || !tag.startsWith("v")) return null;
  const version = tag.slice(1);
  return isVersion(version) ? version : null;
}

function safeHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}
