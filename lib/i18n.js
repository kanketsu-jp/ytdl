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
    // pre-download info
    fetchingInfo: "動画情報を取得中...",
    fetchInfoFailed: "動画情報の取得に失敗しました。URLを確認してください。",
    confirmDownload: "この動画をダウンロードしますか？",
    // error recovery
    downloadFailed: "ダウンロードに失敗しました",
    retryWithCookie: "クッキー付きでリトライ",
    retryWithCookieDesc: "ブラウザのクッキーを使って再試行（macOSキーチェーンへのアクセス許可が必要）",
    showDetails: "詳細を見る",
    showDetailsDesc: "エラーの詳細を表示",
    abort: "中止",
    abortDesc: "ダウンロードを中止する",
    retrying: "クッキー付きでリトライ中...",
    // advanced settings
    advancedSettings: "より詳細な設定",
    advancedSettingsHint: "字幕言語などを変更",
    subLangsMessage: "字幕言語",
    subLangsDefault: "デフォルト（言語設定に従う）",
    subLangsDefaultHint: "日本語なら ja, 英語なら en",
    subLangsJaEn: "日本語 + 英語",
    subLangsAll: "全言語",
    subLangsCustom: "カスタム",
    subLangsCustomHint: "カンマ区切りで入力（例: ja,en,ko）",
    subLangsCustomMessage: "字幕言語コード（カンマ区切り）",
    subLangsCustomPlaceholder: "ja,en,ko",
    subLangsCustomRequired: "言語コードを入力してください",
    advancedDone: "設定完了",
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
    // pre-download info
    fetchingInfo: "Fetching video info...",
    fetchInfoFailed: "Failed to fetch video info. Please check the URL.",
    confirmDownload: "Download this video?",
    // error recovery
    downloadFailed: "Download failed",
    retryWithCookie: "Retry with cookies",
    retryWithCookieDesc: "Retry using browser cookies (macOS Keychain access will be requested)",
    showDetails: "Show details",
    showDetailsDesc: "Show error details",
    abort: "Abort",
    abortDesc: "Cancel the download",
    retrying: "Retrying with cookies...",
    // advanced settings
    advancedSettings: "Advanced settings",
    advancedSettingsHint: "Change subtitle languages, etc.",
    subLangsMessage: "Subtitle languages",
    subLangsDefault: "Default (follow language setting)",
    subLangsDefaultHint: "ja for Japanese, en for English",
    subLangsJaEn: "Japanese + English",
    subLangsAll: "All languages",
    subLangsCustom: "Custom",
    subLangsCustomHint: "Enter comma-separated codes (e.g. ja,en,ko)",
    subLangsCustomMessage: "Subtitle language codes (comma-separated)",
    subLangsCustomPlaceholder: "ja,en,ko",
    subLangsCustomRequired: "Enter language codes.",
    advancedDone: "Settings saved",
  },
};

const SUPPORTED_LANGS = ["ja", "en"];

function detectLang() {
  // 1. CLI arg: --lang en
  const idx = process.argv.indexOf("--lang");
  if (idx !== -1 && process.argv[idx + 1]) {
    const lang = process.argv[idx + 1];
    if (!SUPPORTED_LANGS.includes(lang)) {
      console.error(`Error: Unsupported language '${lang}'. Supported: ${SUPPORTED_LANGS.join(", ")}`);
      console.error("Use --lang ja or --lang en, or set YTDL_LANG environment variable.");
      process.exit(1);
    }
    return lang;
  }
  // 2. Environment variable: YTDL_LANG=en
  if (process.env.YTDL_LANG) {
    const lang = process.env.YTDL_LANG;
    if (!SUPPORTED_LANGS.includes(lang)) {
      console.error(`Error: Unsupported language '${lang}'. Supported: ${SUPPORTED_LANGS.join(", ")}`);
      console.error("Use --lang ja or --lang en, or set YTDL_LANG environment variable.");
      process.exit(1);
    }
    return lang;
  }
  // 3. Config file: .ytdlrc
  try {
    const content = readFileSync(CONFIG_PATH, "utf-8").trim();
    const match = content.match(/^lang\s*=\s*(\w+)/m);
    if (match) {
      const lang = match[1];
      if (!SUPPORTED_LANGS.includes(lang)) {
        console.error(`Error: Unsupported language '${lang}'. Supported: ${SUPPORTED_LANGS.join(", ")}`);
        console.error("Use --lang ja or --lang en, or set YTDL_LANG environment variable.");
        process.exit(1);
      }
      return lang;
    }
  } catch {
    // no config file
  }
  // 4. Default: ja
  return "ja";
}

const lang = detectLang();
export const t = messages[lang] || messages.ja;
export const currentLang = lang;
