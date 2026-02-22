import * as p from "@clack/prompts";
import pc from "picocolors";
import { t, currentLang } from "./i18n.js";
import { SUBTITLE_DEFAULTS } from "./i18n.js";

export async function interactive() {
  // 1. URL
  const url = await p.text({
    message: t.urlMessage,
    placeholder: t.urlPlaceholder,
    validate: (v) => {
      if (!v) return t.urlRequired;
      try {
        const u = new URL(v);
        if (!["http:", "https:"].includes(u.protocol))
          return t.urlInvalidProtocol;
      } catch {
        return t.urlInvalid;
      }
    },
  });
  if (p.isCancel(url)) return url;

  // 2. Mode
  const mode = await p.select({
    message: t.modeMessage,
    options: [
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
    ],
  });
  if (p.isCancel(mode)) return mode;

  if (mode === "info") {
    return { url, mode };
  }

  // 3. Quality (video only)
  let quality = "best";
  if (mode === "video") {
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
    message: t.L_TRANSCRIBE_ASK || "文字起こしをしますか？",
    initialValue: false,
  });
  if (p.isCancel(wantTranscribe)) return wantTranscribe;

  if (wantTranscribe) {
    transcribe = true;
    transcribeBackend = await p.select({
      message: t.L_TRANSCRIBE_BACKEND || "バックエンドを選択",
      options: [
        { value: "local", label: t.L_TRANSCRIBE_BACKEND_LOCAL || "ローカル（mlx-whisper）" },
        { value: "api", label: t.L_TRANSCRIBE_BACKEND_API || "API（OpenAI Whisper）" },
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
              { value: "api", label: t.L_TRANSCRIBE_SWITCH_API || "API に切り替える" },
              { value: "local", label: t.L_TRANSCRIBE_CONTINUE_LOCAL || "それでもローカルで実行" },
              { value: "cancel", label: t.cancelled || "Cancel" },
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
      ? (t.L_TRANSCRIBE_BACKEND_API || "API")
      : (t.L_TRANSCRIBE_BACKEND_LOCAL || "ローカル");
    summaryLines.push(`${pc.dim("Transcribe")}  ${t.summaryYes} (${backendLabel})`);
  }

  p.note(summaryLines.join("\n"), t.summaryTitle);

  const confirmed = await p.confirm({
    message: t.startDownload,
    initialValue: true,
  });
  if (p.isCancel(confirmed) || !confirmed) return p.symbol.cancel;

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
