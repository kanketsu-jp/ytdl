import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import pc from "picocolors";

const CACHE_DIR = path.join(os.homedir(), ".config", "ytdl");
const CACHE_FILE = path.join(CACHE_DIR, "update-check.json");
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 1 day

/**
 * Check npm registry for a newer version.
 * Returns a formatted message string if an update is available, otherwise null.
 * Never throws — silently returns null on any error.
 * @param {{ name: string, version: string }} pkg
 * @returns {Promise<string|null>}
 */
export async function checkForUpdate(pkg) {
  try {
    // Read cache
    let cache = {};
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    } catch { /* no cache yet */ }

    const now = Date.now();
    let latest = cache.latest;

    // Fetch from registry if cache is stale
    if (!cache.lastCheck || now - cache.lastCheck > CHECK_INTERVAL) {
      latest = await fetchLatest(pkg.name);
      if (latest) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify({ latest, lastCheck: now }));
      }
    }

    if (!latest || latest === pkg.version) return null;
    if (!isNewer(latest, pkg.version)) return null;

    const box = formatBox(pkg.version, latest, pkg.name);
    return box;
  } catch {
    return null;
  }
}

/** Fetch latest version from npm registry (5s timeout) */
async function fetchLatest(name) {
  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.version || null;
  } catch {
    return null;
  }
}

/** Compare semver: is a newer than b? */
function isNewer(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

/** Format a boxed update notification */
function formatBox(current, latest, name) {
  const pad = 2;
  const rawMsg = `Update available ${current} \u2192 ${latest}`;
  const rawCmd = `Run npm i -g ${name} to update`;
  const inner = Math.max(rawMsg.length, rawCmd.length) + pad * 2;
  const line = "\u2500".repeat(inner);
  const row = (raw, colored) => "\u2502" + " ".repeat(pad) + colored + " ".repeat(inner - pad - raw.length) + "\u2502";
  const empty = "\u2502" + " ".repeat(inner) + "\u2502";
  const coloredMsg = `Update available ${pc.dim(current)} \u2192 ${pc.green(latest)}`;
  const coloredCmd = `Run ${pc.cyan(`npm i -g ${name}`)} to update`;
  return "\n" + [
    `\u256d${line}\u256e`, empty,
    row(rawMsg, coloredMsg),
    row(rawCmd, coloredCmd),
    empty, `\u2570${line}\u256f`,
  ].join("\n");
}
