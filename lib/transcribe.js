import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync, renameSync, mkdirSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

/**
 * Transcribe media file
 * @param {string} mediaPath - path to video/audio file
 * @param {Object} options
 * @param {string} options.backend - "local" | "api"
 * @param {string} options.language - language code
 * @param {string} [options.manuscript] - manuscript file path (optional)
 */
export async function transcribe(mediaPath, options) {
  const { backend, language } = options;
  const outputDir = dirname(mediaPath);
  const baseName = basename(mediaPath, extname(mediaPath));

  const prompt = buildPrompt(outputDir, baseName, options);

  if (backend === "local") {
    await runLocal(mediaPath, outputDir, baseName, language, prompt);
  } else {
    await runAPI(mediaPath, outputDir, baseName, language, prompt);
  }
}

/**
 * Build initial_prompt from manuscript or subtitles
 * Priority: manuscript > subtitles > none
 */
function buildPrompt(outputDir, baseName, options) {
  if (options.manuscript) {
    const text = readFileSync(options.manuscript, "utf-8");
    return extractKeywords(text);
  }

  const subtitleFile = findSubtitleFile(outputDir, baseName);
  if (subtitleFile) {
    const text = readFileSync(subtitleFile, "utf-8");
    const cleaned = stripSRTTimestamps(text);
    return extractKeywords(cleaned);
  }

  return "";
}

/**
 * Extract keywords from text for initial_prompt (within ~200 chars)
 */
function extractKeywords(text) {
  const katakana = text.match(/[\u30A0-\u30FF]{3,}/g) || [];
  const kanji = text.match(/[\u4E00-\u9FFF]{3,}/g) || [];
  const names = text.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)+/g) || [];

  const freq = new Map();
  for (const w of [...katakana, ...kanji, ...names]) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  const sorted = [...freq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  // If not enough repeated words, include single occurrences
  if (sorted.length < 5) {
    const singles = [...freq.entries()]
      .filter(([, c]) => c === 1)
      .map(([w]) => w)
      .slice(0, 10);
    sorted.push(...singles);
  }

  let result = "";
  for (const w of sorted) {
    const next = result ? result + "、" + w : w;
    if (next.length > 200) break;
    result = next;
  }
  return result;
}

function findSubtitleFile(dir, baseName) {
  const candidates = readdirSync(dir).filter(
    (f) => f.startsWith(baseName) && /\.(srt|vtt)$/.test(f) && !f.includes(".whisper.")
  );
  return candidates.length > 0 ? join(dir, candidates[0]) : null;
}

// --- Local (mlx-whisper) ---

async function runLocal(mediaPath, outputDir, baseName, language, prompt) {
  const args = [
    "--model", "mlx-community/whisper-large-v3-turbo",
    "--output-format", "all",
    "--word-timestamps", "True",
    "--condition-on-previous-text", "False",
    "--output-dir", outputDir,
  ];
  if (language) args.push("--language", language);
  if (prompt) args.push("--initial-prompt", prompt);
  args.push(mediaPath);

  await spawnAsync("mlx_whisper", args);

  // Rename {baseName}.ext → {baseName}.whisper.ext
  for (const ext of ["srt", "txt", "json", "vtt"]) {
    const src = join(outputDir, `${baseName}.${ext}`);
    const dst = join(outputDir, `${baseName}.whisper.${ext}`);
    if (existsSync(src)) renameSync(src, dst);
  }
}

// --- API (OpenAI Whisper) ---

async function runAPI(mediaPath, outputDir, baseName, language, prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  // Extract audio (video → mp3)
  const audioPath = join(outputDir, `${baseName}.tmp.mp3`);
  execSync(`ffmpeg -i "${mediaPath}" -vn -acodec libmp3lame -b:a 128k -y "${audioPath}"`, { stdio: "pipe" });

  const sizeMB = statSync(audioPath).size / (1024 * 1024);
  let result;

  if (sizeMB <= 24) {
    result = await callWhisperAPI(audioPath, apiKey, language, prompt);
  } else {
    result = await callWhisperAPIChunked(audioPath, apiKey, language, prompt, outputDir, baseName);
  }

  // Write output files
  const prefix = join(outputDir, `${baseName}.whisper`);
  writeFileSync(`${prefix}.txt`, result.text, "utf-8");
  writeFileSync(`${prefix}.json`, JSON.stringify(result, null, 2), "utf-8");
  if (result.segments) {
    writeFileSync(`${prefix}.srt`, toSRT(result.segments), "utf-8");
    writeFileSync(`${prefix}.vtt`, toVTT(result.segments), "utf-8");
  }

  // Cleanup temp file
  try { execSync(`rm -f "${audioPath}"`, { stdio: "pipe" }); } catch { /* ignore */ }
}

async function callWhisperAPI(audioPath, apiKey, language, prompt) {
  const form = new FormData();
  form.append("file", new Blob([readFileSync(audioPath)]), basename(audioPath));
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  if (language) form.append("language", language);
  if (prompt) form.append("prompt", prompt);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function callWhisperAPIChunked(audioPath, apiKey, language, prompt, outputDir, baseName) {
  const tmpDir = join(outputDir, `.whisper-tmp-${baseName}`);
  mkdirSync(tmpDir, { recursive: true });

  // Split into 10-minute chunks
  execSync(`ffmpeg -i "${audioPath}" -f segment -segment_time 600 -c copy "${tmpDir}/chunk_%03d.mp3"`, { stdio: "pipe" });

  const chunks = readdirSync(tmpDir).filter((f) => f.startsWith("chunk_")).sort();
  const allSegments = [];
  let fullText = "";
  let timeOffset = 0;

  for (const chunk of chunks) {
    const result = await callWhisperAPI(join(tmpDir, chunk), apiKey, language, prompt);
    fullText += result.text;
    if (result.segments) {
      for (const seg of result.segments) {
        allSegments.push({ ...seg, start: seg.start + timeOffset, end: seg.end + timeOffset });
      }
      timeOffset += result.segments[result.segments.length - 1].end;
    }
  }

  try { execSync(`rm -rf "${tmpDir}"`, { stdio: "pipe" }); } catch { /* ignore */ }
  return { text: fullText, segments: allSegments };
}

// --- SRT / VTT generation ---

function toSRT(segments) {
  return segments.map((s, i) =>
    `${i + 1}\n${fmtSRT(s.start)} --> ${fmtSRT(s.end)}\n${s.text.trim()}\n`
  ).join("\n");
}

function toVTT(segments) {
  return "WEBVTT\n\n" + segments.map((s) =>
    `${fmtVTT(s.start)} --> ${fmtVTT(s.end)}\n${s.text.trim()}\n`
  ).join("\n");
}

function fmtSRT(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60),
        s = Math.floor(sec % 60), ms = Math.floor((sec % 1) * 1000);
  return `${p2(h)}:${p2(m)}:${p2(s)},${p3(ms)}`;
}

function fmtVTT(sec) { return fmtSRT(sec).replace(",", "."); }
function p2(n) { return String(n).padStart(2, "0"); }
function p3(n) { return String(n).padStart(3, "0"); }

function spawnAsync(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: "inherit" });
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`)));
  });
}

function stripSRTTimestamps(text) {
  return text
    .replace(/^\d+\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}\n/gm, "")
    .replace(/^\d+$/gm, "")
    .trim();
}
