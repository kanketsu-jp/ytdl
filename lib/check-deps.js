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
    return false
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
  try {
    await import(name)
    return true
  } catch {
    // 非インタラクティブ環境ではメッセージのみ
    if (!process.stdin.isTTY) {
      console.error(pc.yellow(t.backendDepMissing.replace('{0}', name)))
      console.error(`  ${pc.cyan(`npm install ${name}`)}`)
      return false
    }

    console.error("")
    console.error(pc.yellow(t.backendDepMissing.replace('{0}', name)))
    console.error("")

    const action = await p.select({
      message: t.installBackendDep.replace('{0}', name),
      options: [
        { value: "install", label: t.installOption, hint: `npm install ${name}` },
        { value: "skip", label: t.skipOption },
      ],
    })

    if (p.isCancel(action) || action === "skip") {
      return false
    }

    // npm install を実行
    const s = p.spinner()
    s.start(`${name} ${t.installing}`)
    const result = spawnSync("npm", ["install", name], {
      stdio: "pipe",
      cwd: process.cwd(),
    })

    if (result.status === 0) {
      s.stop(`${name} ${t.installSuccess}`)
      // インストール後にインポート可能か再確認
      try {
        await import(name)
        return true
      } catch {
        // npm install は成功したが import できない場合
        console.error(pc.yellow(`${name} のインストールは完了しましたが、読み込めませんでした。`))
        console.error(`  ${pc.cyan(`npm install -g ${name}`)} を試してください。`)
        return false
      }
    } else {
      s.stop(`${name} ${t.installFail}`)
      console.error(`  ${pc.cyan(`npm install -g ${name}`)}`)
      return false
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
