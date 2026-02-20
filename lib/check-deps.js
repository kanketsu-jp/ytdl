import { execFileSync, spawnSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { t } from "./i18n.js";

const DEPS = [
  {
    cmd: "yt-dlp",
    label: "yt-dlp (video downloader)",
    brew: "yt-dlp",
    url: "https://github.com/yt-dlp/yt-dlp#installation",
  },
  {
    cmd: "ffmpeg",
    label: "ffmpeg (media converter)",
    brew: "ffmpeg",
    url: "https://ffmpeg.org/download.html",
  },
];

function exists(cmd) {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasBrew() {
  return exists("brew");
}

function brewInstall(pkg) {
  const result = spawnSync("brew", ["install", pkg], { stdio: "inherit" });
  return result.status === 0;
}

export async function checkDeps() {
  const missing = DEPS.filter((d) => !exists(d.cmd));
  if (missing.length === 0) return;

  // Non-interactive context (e.g. piped, CI) — just print and exit
  if (!process.stdin.isTTY) {
    console.error("");
    console.error(pc.red(t.missingDeps));
    for (const d of missing) {
      console.error(`  ${pc.bold(d.cmd)}  ${pc.dim(d.label)}`);
      console.error(`  ${pc.dim(d.url)}`);
    }
    process.exit(1);
  }

  console.error("");
  console.error(pc.red(t.missingDeps));
  for (const d of missing) {
    console.error(`  ${pc.bold(d.cmd)}  ${pc.dim(d.label)}`);
  }
  console.error("");

  if (!hasBrew()) {
    console.error(pc.yellow(t.brewNotFound));
    for (const d of missing) {
      console.error(`  ${pc.cyan(`brew install ${d.brew}`)}  ${pc.dim(d.url)}`);
    }
    process.exit(1);
  }

  const action = await p.select({
    message: t.installPrompt,
    options: [
      { value: "install", label: t.installOption, hint: t.installOptionDesc },
      { value: "skip", label: t.skipOption, hint: t.skipOptionDesc },
    ],
  });

  if (p.isCancel(action) || action === "skip") {
    for (const d of missing) {
      console.error(`  ${pc.cyan(`brew install ${d.brew}`)}  ${pc.dim(d.url)}`);
    }
    process.exit(1);
  }

  // Install
  for (const d of missing) {
    const s = p.spinner();
    s.start(`${d.cmd} ${t.installing}`);
    const ok = brewInstall(d.brew);
    if (ok) {
      s.stop(`${d.cmd} ${t.installSuccess}`);
    } else {
      s.stop(pc.red(`${d.cmd} ${t.installFail}`));
      console.error(`  ${pc.cyan(`brew install ${d.brew}`)}`);
      console.error(`  ${pc.dim(d.url)}`);
      process.exit(1);
    }
  }
}

// Allow direct execution for postinstall check (non-interactive, warning only)
if (
  process.argv[1] &&
  process.argv[1].endsWith("check-deps.js")
) {
  const missing = DEPS.filter((d) => !exists(d.cmd));
  if (missing.length > 0 && !process.argv.includes("--quiet")) {
    console.error("");
    console.error(pc.yellow(t.missingDeps));
    for (const d of missing) {
      console.error(`  ${pc.bold(d.cmd)}  ${pc.cyan(`brew install ${d.brew}`)}`);
    }
    console.error("");
  }
}
