import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { t } from "./i18n.js";

/** ytdl パッケージ自身のルートディレクトリ（package.json がある場所） */
const YTDL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 利用可能な Node パッケージマネージャーを検出する。
 * bun > pnpm > npm の優先順で返す。
 * @returns {{ cmd: string, install: string[] }}
 */
function detectPM() {
  if (exists("bun"))  return { cmd: "bun",  install: ["add", "--no-save"] };
  if (exists("pnpm")) return { cmd: "pnpm", install: ["add", "--save-dev=false"] };
  return { cmd: "npm", install: ["install", "--no-save"] };
}

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
      s.error(`${d.cmd} ${t.installFail}`);
      console.error(`  ${pc.cyan(`brew install ${d.brew}`)}`);
      console.error(`  ${pc.dim(d.url)}`);
      process.exit(1);
    }
  }
}

export async function checkTranscribeDeps(backend) {
  if (backend === "local") {
    if (!exists("mlx_whisper")) {
      console.error("");
      console.error(pc.yellow("mlx-whisper is not installed."));
      console.error(`  ${pc.cyan("pip install mlx-whisper")}`);
      console.error("");
      return false;
    }
  }
  if (backend === "api") {
    if (!process.env.OPENAI_API_KEY) {
      console.error("");
      console.error(pc.yellow("OPENAI_API_KEY is not set."));
      console.error(`  ${pc.cyan("export OPENAI_API_KEY=sk-...")}`);
      console.error("");
      return false;
    }
  }
  return true;
}

/**
 * npm パッケージがインポート可能か静的に確認する（UIなし）。
 * @param {string} name - パッケージ名
 * @returns {Promise<boolean>}
 */
export async function isBackendDepAvailable(name) {
  try {
    await import(name)
    return true
  } catch {
    // フォールバック: ytdl の node_modules から探す
    try {
      await import(path.join(YTDL_ROOT, "node_modules", name))
      return true
    } catch {
      return false
    }
  }
}

/**
 * バックエンド固有の npm パッケージが利用可能か確認する。
 * 未インストールの場合はインタラクティブにインストールを尋ねる。
 * ユーザーが拒否した場合は false を返す（process.exit しない）。
 * @param {string} name - パッケージ名（例: 'webtorrent'）
 * @returns {Promise<boolean>}
 */
export async function checkBackendDep(name) {
  // まず通常の解決、次に ytdl の node_modules を試す
  try {
    await import(name)
    return true
  } catch {
    try {
      await import(path.join(YTDL_ROOT, "node_modules", name))
      return true
    } catch { /* fall through to install prompt */ }
  }

  // 非インタラクティブ環境ではメッセージのみ
  if (!process.stdin.isTTY) {
    console.error(pc.yellow(t.backendDepMissing.replace('{0}', name)))
    console.error(`  ${pc.cyan(`npm install ${name}`)}`)
    return false
  }

  console.error("")
  console.error(pc.yellow(t.backendDepMissing.replace('{0}', name)))
  console.error("")

  const pm = detectPM()

  const action = await p.select({
    message: t.installBackendDep.replace('{0}', name),
    options: [
      { value: "install", label: t.installOption, hint: `${pm.cmd} ${pm.install[0]} ${name}` },
      { value: "skip", label: t.skipOption },
    ],
  })

  if (p.isCancel(action) || action === "skip") {
    return false
  }

  // ytdl パッケージディレクトリにインストール
  const s = p.spinner()
  s.start(`${name} ${t.installing}`)
  const result = spawnSync(pm.cmd, [...pm.install, name], {
    stdio: "pipe",
    cwd: YTDL_ROOT,
  })

  if (result.status === 0) {
    s.stop(`${name} ${t.installSuccess}`)
    // インストール先を明示指定して再読み込み
    try {
      const depPath = path.join(YTDL_ROOT, "node_modules", name)
      await import(depPath)
      return true
    } catch {
      console.error(pc.yellow(t.backendDepLoadFail?.replace('{0}', name) || `${name} をインストールしましたが読み込めませんでした。`))
      console.error(`  ${pc.cyan(`npm install -g ${name}`)}`)
      return false
    }
  } else {
    s.stop(`${name} ${t.installFail}`)
    console.error(`  ${pc.cyan(`npm install -g ${name}`)}`)
    return false
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
