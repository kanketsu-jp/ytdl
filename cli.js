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

// --- Strip --lang from argv before passing to bash ---
const rawArgv = process.argv.slice(2);
const langIdx = rawArgv.indexOf("--lang");
const argv = [];
for (let i = 0; i < rawArgv.length; i++) {
  if (rawArgv[i] === "--lang") {
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

async function run() {
  await checkDeps();

  p.intro(pc.cyan("ytdl"));

  const opts = await interactive();
  if (p.isCancel(opts)) {
    p.cancel(t.cancelled);
    process.exit(0);
  }

  const args = buildArgs(opts);

  console.log("");
  p.log.info(
    `${pc.dim("yt-dlp")} ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`
  );
  console.log("");

  const child = spawn("bash", [SCRIPT, "--lang", currentLang, ...args], {
    stdio: "inherit",
  });
  child.on("close", (code) => {
    if (code === 0) {
      p.outro(pc.green(t.done));
    } else {
      p.outro(pc.red(`${t.exitedWithCode} ${code}`));
    }
    process.exit(code ?? 0);
  });
}
