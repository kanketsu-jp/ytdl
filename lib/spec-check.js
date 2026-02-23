import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CACHE = join(homedir(), ".config", "ytdl", "machine-spec.json");

export function checkMachineSpec() {
  if (existsSync(CACHE)) return evaluate(JSON.parse(readFileSync(CACHE, "utf-8")));

  const spec = detect();
  mkdirSync(join(homedir(), ".config", "ytdl"), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(spec, null, 2));
  return evaluate(spec);
}

function detect() {
  if (process.platform !== "darwin") {
    return { platform: process.platform, isAppleSilicon: false, memoryGB: 0 };
  }
  const isAS = (() => {
    try { return execSync("sysctl -n hw.optional.arm64", { encoding: "utf-8" }).trim() === "1"; }
    catch { return false; }
  })();
  const mem = (() => {
    try { return Math.round(parseInt(execSync("sysctl -n hw.memsize", { encoding: "utf-8" })) / 1073741824); }
    catch { return 0; }
  })();
  const chip = (() => {
    try { return execSync("sysctl -n machdep.cpu.brand_string", { encoding: "utf-8" }).trim(); }
    catch { return "Unknown"; }
  })();
  return { platform: "darwin", chip, isAppleSilicon: isAS, memoryGB: mem, checkedAt: new Date().toISOString() };
}

function evaluate(spec) {
  if (spec.isAppleSilicon && spec.memoryGB >= 8) return { ok: true, spec };
  return {
    ok: false,
    spec,
    message: spec.platform !== "darwin"
      ? "mlx-whisper requires macOS (Apple Silicon). Please use the API backend."
      : !spec.isAppleSilicon
        ? "Intel Mac detected — mlx-whisper will be extremely slow. Switch to API?"
        : `Memory ${spec.memoryGB}GB is insufficient. Switch to API?`,
  };
}

export function clearCache() { if (existsSync(CACHE)) unlinkSync(CACHE); }
