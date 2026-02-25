#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { checkDeps } from "./lib/check-deps.js";
import { interactive, isCancelled } from "./lib/interactive.js";
import { buildArgs } from "./lib/build-args.js";
import { t, currentLang } from "./lib/i18n.js";
import { routeUrl } from "./lib/router.js";
import { getBackend, getBackendByName, getAvailableBackend } from "./lib/backends/index.js";
import { maybeOpenDir } from "./lib/open-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "bin", "ytdl.sh");

// --- Strip --lang, transcribe, routing options from argv before passing to bash ---
const rawArgv = process.argv.slice(2);
const argv = [];
let viaBackend = null;    // --via <name> で手動指定されたバックエンド名
let forceAnalyze = false; // --analyze フラグ
let duration = null;      // --duration <sec> ストリーム録画時間
for (let i = 0; i < rawArgv.length; i++) {
  if (rawArgv[i] === "--lang") {
    i++; // skip value
    continue;
  }
  if (rawArgv[i] === "--backend" || rawArgv[i] === "--manuscript") {
    i++; // skip value
    continue;
  }
  // --via <backend>: バックエンドを手動指定
  if (rawArgv[i] === "--via") {
    viaBackend = rawArgv[++i];
    continue;
  }
  // --analyze: サイト解析モードを強制
  if (rawArgv[i] === "--analyze") {
    forceAnalyze = true;
    continue;
  }
  // --duration <sec>: ストリーム録画時間（秒）
  if (rawArgv[i] === "--duration") {
    duration = parseInt(rawArgv[++i], 10) || null;
    continue;
  }
  argv.push(rawArgv[i]);
}

if (argv.includes("-h") || argv.includes("--help")) {
  spawn("bash", [SCRIPT, "-h", "--lang", currentLang], { stdio: "inherit" }).on(
    "close",
    (c) => process.exit(c ?? 0)
  );
} else if (argv.length > 0) {
  // Has arguments — route to appropriate backend
  checkDeps().then(async () => {
    // URL 引数の抽出（フラグ以外の最後の引数をURLと見なす）
    // シェルのバックスラッシュエスケープ（\? \= \& 等）を除去して argv も更新
    const rawUrlIdx = argv.findIndex((a) => !a.startsWith("-"));
    const urlArg = rawUrlIdx !== -1 ? argv[rawUrlIdx].replace(/\\([?=&])/g, "$1") : null;
    if (rawUrlIdx !== -1) argv[rawUrlIdx] = urlArg;

    // -o フラグから出力ディレクトリを取得
    const oIdx = argv.indexOf("-o");
    const cliOutputDir = oIdx !== -1 && argv[oIdx + 1] ? argv[oIdx + 1] : "~/Downloads";

    // --analyze フラグまたは --via analyzer 指定の場合
    if (forceAnalyze || viaBackend === "analyzer") {
      const backend = getBackendByName("analyzer");
      if (backend) {
        const depsOk = await backend.checkDeps();
        if (!depsOk) process.exit(1);
        const result = await backend.download(urlArg, { args: argv, duration });
        if (result.code === 0) await onDownloadSuccess(cliOutputDir);
        process.exit(result.code ?? 0);
        return;
      }
    }

    // --via で手動バックエンド指定
    if (viaBackend && viaBackend !== "ytdlp") {
      const backend = getBackendByName(viaBackend);
      if (backend) {
        const depsOk = await backend.checkDeps();
        if (!depsOk) process.exit(1);
        const result = await backend.download(urlArg, { args: argv, duration });
        if (result.code === 0) await onDownloadSuccess(cliOutputDir);
        process.exit(result.code ?? 0);
        return;
      }
    }

    // URL からバックエンドを自動判定
    if (urlArg) {
      const route = routeUrl(urlArg);
      if (route.backend !== "ytdlp") {
        const backend = getBackendByName(route.backend);
        if (backend) {
          // 依存パッケージが未インストールならインストールを尋ねる
          const depsOk = await backend.checkDeps();
          if (depsOk) {
            const result = await backend.download(urlArg, { args: argv, duration });
            if (result.code === 0) await onDownloadSuccess(cliOutputDir);
            process.exit(result.code ?? 0);
            return;
          }
          // ユーザーがインストールを拒否 → ytdlp にフォールバック
        }
      }
    }

    // デフォルト: 既存の ytdlp フロー（bin/ytdl.sh に直接パス）
    const isInfoOnly = argv.includes("-i");
    const child = spawn("bash", [SCRIPT, "--lang", currentLang, ...argv], {
      stdio: "inherit",
    });
    child.on("close", async (code) => {
      if (code === 0 && !isInfoOnly) await onDownloadSuccess(cliOutputDir);
      process.exit(code ?? 0);
    });
  });
} else {
  // No arguments — interactive mode
  run();
}

/** ダウンロード成功後にディレクトリを開くか確認する共通ヘルパー */
async function onDownloadSuccess(outputDir) {
  await maybeOpenDir(outputDir || "~/Downloads", {
    confirm: async (msg) => {
      const ans = await p.confirm({ message: msg, initialValue: false });
      return !p.isCancel(ans) && ans;
    },
    log: (msg) => p.log.info(msg),
    openDirMessage: t.openDir,
  });
}

/** Run bash script and capture stderr, return { code, stderr } */
function runScript(args) {
  return new Promise((resolve) => {
    const chunks = [];
    const child = spawn("bash", [SCRIPT, "--lang", currentLang, ...args], {
      stdio: ["inherit", "inherit", "pipe"],
    });
    child.stderr.on("data", (d) => chunks.push(d));
    child.on("close", (code) => {
      resolve({ code: code ?? 0, stderr: Buffer.concat(chunks).toString() });
    });
  });
}

// インタラクティブモードでの info 取得は spawn で直接実行（ytdlp バックエンド同等）

async function run() {
  await checkDeps();

  p.intro(pc.cyan("ytdl"));

  const opts = await interactive();
  if (isCancelled(opts)) {
    p.cancel(t.cancelled);
    process.exit(0);
  }

  // --- torrent バックエンドは独自フローで処理 ---
  if (opts.backend === "torrent") {
    const backend = getBackendByName("torrent");
    if (!backend) {
      p.log.error("torrent バックエンドが見つかりません");
      process.exit(1);
    }
    const depsOk = await backend.checkDeps();
    if (!depsOk) {
      p.outro(pc.yellow("webtorrent が未インストールのため中止しました"));
      process.exit(1);
    }
    const result = await backend.download(opts.url, { outputDir: opts.outputDir });
    if (result.code === 0) await onDownloadSuccess(opts.outputDir);
    p.outro(result.code === 0 ? pc.green(t.done) : pc.red(`${t.exitedWithCode} ${result.code}`));
    process.exit(result.code ?? 0);
    return;
  }

  // --- analyzer バックエンドは独自フローで処理 ---
  if (opts.backend === "analyzer") {
    const backend = getBackendByName("analyzer");
    if (!backend) {
      p.log.error("analyzer バックエンドが見つかりません");
      process.exit(1);
    }
    const depsOk = await backend.checkDeps();
    if (!depsOk) {
      p.outro(pc.yellow("Chrome / ws が未インストールのため中止しました"));
      process.exit(1);
    }
    const oArgs = [];
    if (opts.outputDir && opts.outputDir !== "~/Downloads") {
      oArgs.push("-o", opts.outputDir);
    }
    const result = await backend.download(opts.url, { args: [opts.url, ...oArgs] });
    if (result.code === 0) await onDownloadSuccess(opts.outputDir);
    p.outro(result.code === 0 ? pc.green(t.done) : pc.red(`${t.exitedWithCode} ${result.code}`));
    process.exit(result.code ?? 0);
    return;
  }

  // --- Pre-download info (skip for info-only mode) ---
  if (opts.mode !== "info") {
    p.log.step(t.fetchingInfo);
    const infoCode = await new Promise((resolve) => {
      const child = spawn("bash", [SCRIPT, "--lang", currentLang, "-n", "-i", opts.url], {
        stdio: "inherit",
      });
      child.on("close", (code) => resolve(code ?? 1));
    });
    if (infoCode !== 0) {
      p.log.warn(pc.yellow(t.fetchInfoFailed));
      const cont = await p.confirm({
        message: t.confirmDownload,
        initialValue: true,
      });
      if (p.isCancel(cont) || !cont) {
        p.cancel(t.cancelled);
        process.exit(0);
      }
    }
  }

  const args = buildArgs(opts);

  if (opts.transcribe) {
    args.push("-t");
    if (opts.transcribeBackend && opts.transcribeBackend !== "local") {
      args.push("--backend", opts.transcribeBackend);
    }
  }

  console.log("");
  p.log.info(
    `${pc.dim("yt-dlp")} ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`
  );
  console.log("");

  // --- Execute download ---
  const result = await runScript(args);

  if (result.code === 0) {
    await onDownloadSuccess(opts.outputDir);
    p.outro(pc.green(t.done));
    process.exit(0);
  }

  // --- Error recovery (interactive) ---
  let stderrOutput = result.stderr;
  let lastCode = result.code;

  while (true) {
    const action = await p.select({
      message: t.downloadFailed,
      options: [
        { value: "retry-cookie", label: t.retryWithCookie, hint: t.retryWithCookieDesc },
        { value: "analyze", label: t.tryAnalyzer, hint: t.backendAnalyzer },
        { value: "details", label: t.showDetails, hint: t.showDetailsDesc },
        { value: "abort", label: t.abort, hint: t.abortDesc },
      ],
    });

    if (p.isCancel(action) || action === "abort") {
      p.outro(pc.red(`${t.exitedWithCode} ${lastCode}`));
      process.exit(lastCode);
    }

    if (action === "details") {
      console.log("");
      console.log(stderrOutput || pc.dim("(no stderr output)"));
      console.log("");
      continue;
    }

    if (action === "analyze") {
      // サイト解析バックエンドにフォールバック
      const analyzerBackend = getBackendByName("analyzer");
      if (!analyzerBackend) {
        p.log.warn("analyzer バックエンドが利用できません");
        continue;
      }
      const analyzerOk = await analyzerBackend.checkDeps();
      if (!analyzerOk) {
        p.log.warn("Chrome / ws が未インストールのためサイト解析をスキップしました");
        continue;
      }
      p.log.info(t.analyzerScanning);
      const analyzeResult = await analyzerBackend.download(opts.url, { args });
      if (analyzeResult.code === 0) {
        await onDownloadSuccess(opts.outputDir);
        p.outro(pc.green(t.done));
        process.exit(0);
      }
      lastCode = analyzeResult.code;
      stderrOutput = analyzeResult.stderr || "";
      continue;
    }

    if (action === "retry-cookie") {
      p.log.info(t.retrying);
      console.log("");
      const retryArgs = ["-b", "chrome", ...args];
      const retryResult = await runScript(retryArgs);
      if (retryResult.code === 0) {
        await onDownloadSuccess(opts.outputDir);
        p.outro(pc.green(t.done));
        process.exit(0);
      }
      stderrOutput = retryResult.stderr;
      lastCode = retryResult.code;
      // loop back to error recovery
    }
  }
}
