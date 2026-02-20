export function buildArgs(opts) {
  const args = [];

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

  args.push(opts.url);
  return args;
}
