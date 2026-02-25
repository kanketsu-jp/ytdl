import * as p from "@clack/prompts";
import pc from "picocolors";
import { t, currentLang } from "./i18n.js";
import { SUBTITLE_DEFAULTS } from "./i18n.js";
import { routeUrl } from "./router.js";

/** キャンセルを表すシンボル。cli.js で isCancelled() で検出する。 */
export const CANCEL = Symbol("ytdl:cancel");
export function isCancelled(v) { return v === CANCEL || p.isCancel(v); }

/**
 * 設定メニューを表示する。ESC で呼び出し元に戻る。
 * config.json の読み書きは analyzer.js のヘルパーを使用。
 */
async function showSettings() {
  const { readConfig, writeConfig } = await import("./backends/analyzer.js");

  // 設定ループ（ESC / 「戻る」で抜ける）
  while (true) {
    const config = readConfig();

    const profileStatus = config.persistentProfile === true
      ? pc.green(t.settingsEnabled)
      : pc.dim(t.settingsDisabled);
    const openDirStatus = config.openDir === 'auto'
      ? pc.green(t.settingsOpenDirAuto)
      : config.openDir === 'never'
        ? pc.dim(t.settingsOpenDirNever)
        : pc.cyan(t.settingsOpenDirAsk);

    const choice = await p.select({
      message: t.settingsTitle,
      options: [
        {
          value: "profile",
          label: `${t.settingsPersistentProfile}  [${profileStatus}]`,
          hint: t.settingsPersistentProfileHint,
        },
        {
          value: "openDir",
          label: `${t.settingsOpenDir}  [${openDirStatus}]`,
          hint: t.settingsOpenDirHint,
        },
        { value: "back", label: t.settingsBack },
      ],
    });

    if (p.isCancel(choice) || choice === "back") break;

    if (choice === "profile") {
      const enabled = await p.confirm({
        message: t.analyzerProfileConfirm,
        initialValue: config.persistentProfile === true,
      });
      if (!p.isCancel(enabled)) {
        await writeConfig({ persistentProfile: !!enabled });
        p.log.success(t.settingsSaved);
      }
    }

    if (choice === "openDir") {
      const openDirChoice = await p.select({
        message: t.settingsOpenDir,
        options: [
          { value: "auto", label: t.settingsOpenDirAuto },
          { value: "ask", label: t.settingsOpenDirAsk },
          { value: "never", label: t.settingsOpenDirNever },
        ],
      });
      if (!p.isCancel(openDirChoice)) {
        await writeConfig({ openDir: openDirChoice });
        p.log.success(t.settingsSaved);
      }
    }
  }
}

export async function interactive() {
  // 1. URL or Settings
  let url;
  while (true) {
    const input = await p.select({
      message: t.urlMessage,
      options: [
        { value: "_input_url", label: "URL", hint: t.urlPlaceholder },
        { value: "_settings", label: t.settingsMenu, hint: "⚙" },
      ],
    });

    if (p.isCancel(input)) return input;

    if (input === "_settings") {
      await showSettings();
      continue;
    }

    // URL 入力
    const urlInput = await p.text({
      message: t.urlMessage,
      placeholder: t.urlPlaceholder,
      validate: (v) => {
        if (!v) return t.urlRequired;
        if (v.startsWith("magnet:")) return;
        if (/\.torrent(\?.*)?$/.test(v)) return;
        try {
          const u = new URL(v);
          if (!["http:", "https:", "rtmp:", "rtsp:"].includes(u.protocol))
            return t.urlInvalidProtocol;
        } catch {
          return t.urlInvalid;
        }
      },
    });
    if (p.isCancel(urlInput)) return urlInput;
    url = urlInput;
    break;
  }

  // URL ルーティング判定
  const route = routeUrl(url);
  const isTorrent = route.backend === "torrent";
  const isStream = route.backend === "stream";

  // torrent URL の場合: mode/quality/playlist/advanced/transcribe をスキップして保存先のみ聞く
  if (isTorrent) {
    const outputDir = await p.text({
      message: t.saveTo,
      placeholder: "~/Downloads",
      defaultValue: "~/Downloads",
    });
    if (p.isCancel(outputDir)) return outputDir;

    p.note(
      [
        `${pc.dim(t.summaryUrl)}       ${url}`,
        `${pc.dim("バックエンド")}   torrent (webtorrent)`,
        `${pc.dim(t.summarySaveTo)}   ${outputDir || "~/Downloads"}`,
      ].join("\n"),
      t.summaryTitle
    );

    const confirmed = await p.confirm({
      message: t.startDownload,
      initialValue: true,
    });
    if (p.isCancel(confirmed) || !confirmed) return CANCEL;

    return {
      url,
      mode: "download",
      backend: "torrent",
      outputDir: outputDir || "~/Downloads",
    };
  }

  // 2. Mode（rtmp/rtsp はモード選択をスキップ）
  let mode = "video";
  if (!isStream) {
    const modeOptions = [
      {
        value: "video",
        label: t.modeVideo,
        hint: t.modeVideoHint,
      },
      {
        value: "audio",
        label: t.modeAudio,
        hint: t.modeAudioHint,
      },
      {
        value: "info",
        label: t.modeInfo,
        hint: t.modeInfoHint,
      },
    ];

    // http/https URL の場合のみサイト解析オプションを表示
    if (/^https?:\/\//i.test(url)) {
      modeOptions.push({
        value: "analyzer",
        label: t.modeAnalyzer,
        hint: t.modeAnalyzerHint,
      });
    }

    mode = await p.select({
      message: t.modeMessage,
      options: modeOptions,
    });
    if (p.isCancel(mode)) return mode;
  }

  if (mode === "info") {
    return { url, mode };
  }

  // サイト解析モード: 保存先だけ聞いて analyzer バックエンドに委譲
  if (mode === "analyzer") {
    const outputDir = await p.text({
      message: t.saveTo,
      placeholder: "~/Downloads",
      defaultValue: "~/Downloads",
    });
    if (p.isCancel(outputDir)) return outputDir;

    const confirmed = await p.confirm({
      message: t.startDownload,
      initialValue: true,
    });
    if (p.isCancel(confirmed) || !confirmed) return CANCEL;

    return {
      url,
      mode: "video",
      backend: "analyzer",
      outputDir: outputDir || "~/Downloads",
    };
  }

  // 3. Quality（video のみ。rtmp/rtsp は品質選択をスキップ）
  let quality = "best";
  if (mode === "video" && !isStream) {
    quality = await p.select({
      message: t.qualityMessage,
      options: [
        { value: "best", label: t.qualityBest, hint: t.qualityBestHint },
        { value: "2160", label: "4K (2160p)" },
        { value: "1440", label: "1440p" },
        { value: "1080", label: "1080p" },
        { value: "720", label: "720p" },
        { value: "480", label: "480p" },
      ],
    });
    if (p.isCancel(quality)) return quality;
  }

  // 4. Playlist
  const isPlaylist =
    url.includes("playlist") || url.includes("list=");
  let playlist = false;
  if (isPlaylist) {
    playlist = await p.confirm({
      message: t.playlistConfirm,
      initialValue: true,
    });
    if (p.isCancel(playlist)) return playlist;
  }

  // 5. Output directory
  const outputDir = await p.text({
    message: t.saveTo,
    placeholder: "~/Downloads",
    defaultValue: "~/Downloads",
  });
  if (p.isCancel(outputDir)) return outputDir;

  // 6. Advanced settings
  let subLangs = null; // null = default (follow language setting)
  const advanced = await p.confirm({
    message: t.advancedSettings,
    initialValue: false,
  });
  if (p.isCancel(advanced)) return advanced;

  if (advanced) {
    const subOptions = [
      { value: "default", label: t.subLangsDefault, hint: t.subLangsDefaultHint },
    ];

    // "自国語 + 英語" preset: skip if current lang is already English
    if (currentLang !== "en") {
      const nativeSubs = SUBTITLE_DEFAULTS[currentLang] || currentLang;
      subOptions.push({ value: `${nativeSubs},en`, label: t.subLangsJaEn });
    }

    subOptions.push(
      { value: "all", label: t.subLangsAll },
      { value: "custom", label: t.subLangsCustom, hint: t.subLangsCustomHint },
    );

    const subChoice = await p.select({
      message: t.subLangsMessage,
      options: subOptions,
    });
    if (p.isCancel(subChoice)) return subChoice;

    if (subChoice === "custom") {
      const customLangs = await p.text({
        message: t.subLangsCustomMessage,
        placeholder: t.subLangsCustomPlaceholder,
        validate: (v) => {
          if (!v) return t.subLangsCustomRequired;
        },
      });
      if (p.isCancel(customLangs)) return customLangs;
      subLangs = customLangs;
    } else if (subChoice !== "default") {
      subLangs = subChoice;
    }

    p.log.success(t.advancedDone);
  }

  // 7. Transcribe (before Summary)
  let transcribe = false;
  let transcribeBackend = "local";

  const wantTranscribe = await p.confirm({
    message: t.L_TRANSCRIBE_ASK,
    initialValue: false,
  });
  if (p.isCancel(wantTranscribe)) return wantTranscribe;

  if (wantTranscribe) {
    transcribe = true;
    transcribeBackend = await p.select({
      message: t.L_TRANSCRIBE_BACKEND,
      options: [
        { value: "local", label: t.L_TRANSCRIBE_BACKEND_LOCAL },
        { value: "api", label: t.L_TRANSCRIBE_BACKEND_API },
      ],
    });
    if (p.isCancel(transcribeBackend)) return transcribeBackend;

    if (transcribeBackend === "local") {
      try {
        const { checkMachineSpec } = await import("./spec-check.js");
        const result = checkMachineSpec();
        if (!result.ok) {
          const action = await p.select({
            message: result.message,
            options: [
              { value: "api", label: t.L_TRANSCRIBE_SWITCH_API },
              { value: "local", label: t.L_TRANSCRIBE_CONTINUE_LOCAL },
              { value: "cancel", label: t.cancelled },
            ],
          });
          if (p.isCancel(action)) return action;
          if (action === "api") transcribeBackend = "api";
          else if (action === "cancel") transcribe = false;
        }
      } catch (e) {
        p.log.warn("spec-check.js not found, skipping machine spec check");
      }
    }
  }

  // 8. Summary
  const summaryLines = [
    `${pc.dim(t.summaryUrl)}       ${url}`,
    `${pc.dim(t.summaryMode)}      ${mode === "audio" ? t.summaryAudio : `${t.summaryVideo}${quality !== "best" ? ` (${quality}p)` : ""}`}`,
    `${pc.dim(t.summarySaveTo)}   ${outputDir || "~/Downloads"}`,
  ];
  if (playlist) {
    summaryLines.push(`${pc.dim(t.summaryPlaylist)}  ${t.summaryYes}`);
  }
  if (transcribe) {
    const backendLabel = transcribeBackend === "api"
      ? t.L_TRANSCRIBE_BACKEND_API
      : t.L_TRANSCRIBE_BACKEND_LOCAL;
    summaryLines.push(`${pc.dim("Transcribe")}  ${t.summaryYes} (${backendLabel})`);
  }

  p.note(summaryLines.join("\n"), t.summaryTitle);

  const confirmed = await p.confirm({
    message: t.startDownload,
    initialValue: true,
  });
  if (p.isCancel(confirmed) || !confirmed) return CANCEL;

  return {
    url,
    mode,
    quality,
    playlist,
    outputDir: outputDir || "~/Downloads",
    subLangs,
    transcribe,
    transcribeBackend,
  };
}
