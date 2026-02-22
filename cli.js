#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { checkDeps } from "./lib/check-deps.js";
import { interactive } from "./lib/interactive.js";
import { buildArgs } from "./lib/build-args.js";
import { t, currentLang } from "./lib/i18n.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "bin", "ytdl.sh");

// --- Strip --lang and transcribe options from argv before passing to bash ---
const rawArgv = process.argv.slice(2);
const argv = [];
for (let i = 0; i < rawArgv.length; i++) {
  if (rawArgv[i] === "--lang") {
    i++; // skip value
    continue;
  }
  if (rawArgv[i] === "--backend" || rawArgv[i] === "--manuscript") {
    i++; // skip value
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
  // Has arguments — pass through to bash script directly
  checkDeps().then(() => {
    const child = spawn("bash", [SCRIPT, "--lang", currentLang, ...argv], {
      stdio: "inherit",
    });
    child.on("close", (code) => process.exit(code ?? 0));
  });
} else {
  // No arguments — interactive mode
  run();
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

async function run() {
  await checkDeps();

  p.intro(pc.cyan("ytdl"));

  const opts = await interactive();
  if (p.isCancel(opts)) {
    p.cancel(t.cancelled);
    process.exit(0);
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

    if (action === "retry-cookie") {
      p.log.info(t.retrying);
      console.log("");
      const retryArgs = ["-b", "chrome", ...args];
      const retryResult = await runScript(retryArgs);
      if (retryResult.code === 0) {
        p.outro(pc.green(t.done));
        process.exit(0);
      }
      stderrOutput = retryResult.stderr;
      lastCode = retryResult.code;
      // loop back to error recovery
    }
  }
}
