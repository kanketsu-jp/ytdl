import * as p from "@clack/prompts";
import pc from "picocolors";
import { t } from "./i18n.js";

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
    const subChoice = await p.select({
      message: t.subLangsMessage,
      options: [
        { value: "default", label: t.subLangsDefault, hint: t.subLangsDefaultHint },
        { value: "ja,ja-orig,en", label: t.subLangsJaEn },
        { value: "all", label: t.subLangsAll },
        { value: "custom", label: t.subLangsCustom, hint: t.subLangsCustomHint },
      ],
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

  // 7. Summary
  const summaryLines = [
    `${pc.dim(t.summaryUrl)}       ${url}`,
    `${pc.dim(t.summaryMode)}      ${mode === "audio" ? t.summaryAudio : `${t.summaryVideo}${quality !== "best" ? ` (${quality}p)` : ""}`}`,
    `${pc.dim(t.summarySaveTo)}   ${outputDir || "~/Downloads"}`,
  ];
  if (playlist) {
    summaryLines.push(`${pc.dim(t.summaryPlaylist)}  ${t.summaryYes}`);
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
  };
}
