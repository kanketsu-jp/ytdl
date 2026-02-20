import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "..", ".ytdlrc");

const messages = {
  ja: {
    // check-deps
    missingDeps: "依存ツールが見つかりません:",
    installPrompt: "自動でインストールしますか？",
    installOption: "インストールする",
    installOptionDesc: "brew install で自動インストール",
    skipOption: "スキップ",
    skipOptionDesc: "手動でインストールする",
    installing: "をインストール中...",
    installSuccess: "のインストール完了",
    installFail: "インストールに失敗しました。手動でインストールしてください:",
    brewNotFound: "brew が見つかりません。以下を手動でインストールしてください:",
    // interactive
    urlMessage: "URL",
    urlPlaceholder: "https://youtu.be/xxxxx",
    urlRequired: "URL を入力してください。",
    urlInvalidProtocol: "有効な HTTP/HTTPS URL を入力してください。",
    urlInvalid: "有効な URL を入力してください。",
    modeMessage: "何をダウンロードしますか？",
    modeVideo: "動画",
    modeVideoHint: "最高画質, mp4",
    modeAudio: "音声のみ",
    modeAudioHint: "m4a",
    modeInfo: "情報のみ表示",
    modeInfoHint: "ダウンロードしない",
    qualityMessage: "画質",
    qualityBest: "最高画質",
    qualityBestHint: "おすすめ",
    playlistConfirm: "プレイリストのようです。全動画をダウンロードしますか？",
    saveTo: "保存先",
    summaryUrl: "URL",
    summaryMode: "モード",
    summaryAudio: "音声 (m4a)",
    summaryVideo: "動画",
    summarySaveTo: "保存先",
    summaryPlaylist: "プレイリスト",
    summaryYes: "はい",
    summaryTitle: "確認",
    startDownload: "ダウンロードを開始しますか？",
    cancelled: "キャンセルしました。",
    done: "完了",
    exitedWithCode: "終了コード:",
  },
  en: {
    // check-deps
    missingDeps: "Missing dependencies:",
    installPrompt: "Install automatically?",
    installOption: "Install",
    installOptionDesc: "Auto-install via brew",
    skipOption: "Skip",
    skipOptionDesc: "Install manually",
    installing: "Installing",
    installSuccess: "installed successfully",
    installFail: "Installation failed. Please install manually:",
    brewNotFound: "brew not found. Please install manually:",
    // interactive
    urlMessage: "URL",
    urlPlaceholder: "https://youtu.be/xxxxx",
    urlRequired: "URL is required.",
    urlInvalidProtocol: "Enter a valid HTTP/HTTPS URL.",
    urlInvalid: "Enter a valid URL.",
    modeMessage: "What to download?",
    modeVideo: "Video",
    modeVideoHint: "best quality, mp4",
    modeAudio: "Audio only",
    modeAudioHint: "m4a",
    modeInfo: "Show info only",
    modeInfoHint: "no download",
    qualityMessage: "Quality",
    qualityBest: "Best available",
    qualityBestHint: "recommended",
    playlistConfirm: "This looks like a playlist. Download all videos?",
    saveTo: "Save to",
    summaryUrl: "URL",
    summaryMode: "Mode",
    summaryAudio: "audio (m4a)",
    summaryVideo: "video",
    summarySaveTo: "Save to",
    summaryPlaylist: "Playlist",
    summaryYes: "yes",
    summaryTitle: "Summary",
    startDownload: "Start download?",
    cancelled: "cancelled.",
    done: "done.",
    exitedWithCode: "exited with code",
  },
};

function detectLang() {
  // 1. CLI arg: --lang en
  const idx = process.argv.indexOf("--lang");
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  // 2. Environment variable: YTDL_LANG=en
  if (process.env.YTDL_LANG) {
    return process.env.YTDL_LANG;
  }
  // 3. Config file: .ytdlrc
  try {
    const content = readFileSync(CONFIG_PATH, "utf-8").trim();
    const match = content.match(/^lang\s*=\s*(\w+)/m);
    if (match) return match[1];
  } catch {
    // no config file
  }
  // 4. Default: ja
  return "ja";
}

const lang = detectLang();
export const t = messages[lang] || messages.ja;
export const currentLang = lang;
