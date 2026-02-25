export function buildArgs(opts) {
  const args = [];

  // ytdlp 以外のバックエンドは独自に args を構築するため空配列を返す
  if (opts.backend && opts.backend !== 'ytdlp') {
    return args;
  }

  if (opts.mode === "info") {
    args.push("-i", opts.url);
    return args;
  }

  if (opts.mode === "audio") {
    args.push("-a");
  }

  if (opts.mode === "video" && opts.quality && opts.quality !== "best") {
    args.push("-q", opts.quality);
  }

  if (opts.playlist) {
    args.push("-p");
  }

  if (opts.outputDir && opts.outputDir !== "~/Downloads") {
    args.push("-o", opts.outputDir);
  }

  if (opts.subLangs) {
    args.push("-s", opts.subLangs);
  }

  if (opts.transcribe) {
    args.push("-t");
    if (opts.transcribeBackend && opts.transcribeBackend !== "local") {
      args.push("--backend", opts.transcribeBackend);
    }
  }

  args.push(opts.url);
  return args;
}
