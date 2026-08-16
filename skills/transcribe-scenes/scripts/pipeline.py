#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path
from typing import Any

DEFAULT_MODEL = "mlx-community/whisper-large-v3-turbo"
DEFAULT_DEICTIC_TERMS = [
    "ここ",
    "そこ",
    "あそこ",
    "これ",
    "それ",
    "あれ",
    "こちら",
    "こっち",
    "この",
    "その",
    "あの",
    "ご覧",
    "見てください",
    "映って",
]
PROMPT_WARN_CHARS = 900


class PipelineError(Exception):
    pass


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).astimezone().isoformat(timespec="seconds")


def sanitize_name(value: str) -> str:
    value = Path(value).stem if "/" in value else value
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "video"


def project_dir(outdir: str | Path, name: str) -> Path:
    return Path(outdir).expanduser().resolve() / sanitize_name(name)


def ensure_dirs(root: Path) -> None:
    (root / "logs").mkdir(parents=True, exist_ok=True)
    (root / "images").mkdir(parents=True, exist_ok=True)


def log(root: Path, stage: str, message: str) -> None:
    ensure_dirs(root)
    stamp = dt.datetime.now().strftime("%H:%M:%S")
    with (root / "logs" / "run.log").open("a", encoding="utf-8") as f:
        f.write(f"[{stamp}] {stage} {message}\n")


def read_json(path: Path) -> Any:
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError as e:
        raise PipelineError(f"必要なファイルがありません: {path}") from e
    except json.JSONDecodeError as e:
        raise PipelineError(f"JSON を読めません: {path}: {e}") from e


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def run_process(root: Path | None, stage: str, cmd: list[str]) -> subprocess.CompletedProcess[str]:
    if root is not None:
        log(root, stage, "実行: " + " ".join(cmd))
    try:
        proc = subprocess.run(cmd, text=True, capture_output=True, check=False)
    except FileNotFoundError as e:
        raise PipelineError(f"コマンドが見つかりません: {cmd[0]}") from e
    if proc.returncode != 0:
        if root is not None:
            log(root, stage, f"失敗: exit={proc.returncode} {proc.stderr.strip()[:500]}")
        raise PipelineError(f"{cmd[0]} が失敗しました(exit {proc.returncode}):\n{proc.stderr.strip()}")
    if root is not None:
        log(root, stage, "完了")
    return proc


def require_import(imports: dict[str, str]) -> dict[str, Any]:
    loaded: dict[str, Any] = {}
    missing: list[str] = []
    for module, package in imports.items():
        try:
            loaded[module] = __import__(module)
        except ImportError:
            missing.append(package)
    if missing:
        pkgs = " ".join(sorted(set(missing)))
        raise PipelineError(
            "依存パッケージが足りません。次を実行してください:\n"
            f"python3 -m pip install -r skills/transcribe-scenes/scripts/requirements.txt\n"
            f"不足: {pkgs}"
        )
    return loaded


def command_exists(name: str) -> None:
    if shutil.which(name) is None:
        raise PipelineError(f"{name} が見つかりません。インストールしてから再実行してください。")


def source_from_probe(probe: dict[str, Any]) -> dict[str, Any]:
    return probe.get("_pipeline_source", {})


def video_path_from_probe(root: Path) -> Path:
    probe = read_json(root / "logs" / "00_probe.json")
    src = source_from_probe(probe)
    path = src.get("video_file") or src.get("file")
    if not path:
        raise PipelineError("00_probe.json に動画ファイル情報がありません")
    return Path(path)


def duration_from_probe(probe: dict[str, Any]) -> float | None:
    try:
        return float(probe.get("format", {}).get("duration"))
    except (TypeError, ValueError):
        return None


def video_shape_from_probe(probe: dict[str, Any]) -> dict[str, int | None]:
    for stream in probe.get("streams", []):
        if stream.get("codec_type") == "video":
            return {"width": stream.get("width"), "height": stream.get("height")}
    return {"width": None, "height": None}


def get_url_title(url: str) -> str:
    proc = run_process(None, "fetch", ["yt-dlp", "--no-playlist", "-J", url])
    try:
        info = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise PipelineError(f"yt-dlp のメタデータ JSON を読めません: {e}") from e
    return info.get("title") or info.get("id") or "video"


def write_empty_nouns(root: Path) -> None:
    path = root / "logs" / "01_nouns.json"
    if not path.exists():
        write_json(path, {"source": None, "nouns": [], "text": ""})


def write_prompt_copy(root: Path, prompt_file: str | None, prompt: str) -> None:
    nouns = [line.strip() for line in prompt.splitlines() if line.strip()]
    write_json(root / "logs" / "01_nouns.json", {"source": prompt_file, "nouns": nouns, "text": prompt})


def cmd_fetch(args: argparse.Namespace) -> str:
    command_exists("yt-dlp")
    command_exists("ffprobe")
    command_exists("ffmpeg")
    if not args.url and not args.file:
        raise PipelineError("fetch には --url または --file が必要です")
    if args.url and args.file:
        raise PipelineError("--url と --file は同時に指定できません")

    base = args.name
    source_file: Path
    source_url: str | None = args.url
    if args.file:
        source_file = Path(args.file).expanduser().resolve()
        if not source_file.exists():
            raise PipelineError(f"入力ファイルがありません: {source_file}")
        base = base or source_file.stem
    else:
        base = base or get_url_title(args.url)

    name = sanitize_name(base)
    root = project_dir(args.outdir, name)
    ensure_dirs(root)
    log(root, "fetch", f"開始 name={name}")
    write_empty_nouns(root)

    if args.url:
        outtmpl = str(root / "source.%(ext)s")
        run_process(
            root,
            "fetch",
            [
                "yt-dlp",
                "--no-playlist",
                "-f",
                "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best[ext=mp4]/best",
                "--merge-output-format",
                "mp4",
                "-o",
                outtmpl,
                args.url,
            ],
        )
        candidates = sorted(root.glob("source.*"))
        candidates = [p for p in candidates if p.suffix.lower() in {".mp4", ".mov", ".mkv", ".webm", ".m4v"}]
        if not candidates:
            raise PipelineError("yt-dlp は成功しましたが、動画ファイルが見つかりません")
        source_file = candidates[0].resolve()
    else:
        # ローカルファイルはコピーせず、元ファイルを参照して後続工程に渡す。
        source_file = source_file.resolve()

    probe_proc = run_process(
        root,
        "fetch",
        [
            "ffprobe",
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-print_format",
            "json",
            str(source_file),
        ],
    )
    probe = json.loads(probe_proc.stdout)
    probe["_pipeline_source"] = {
        "name": name,
        "url": source_url,
        "file": str(source_file),
        "video_file": str(source_file),
        "audio_file": str((root / "audio.wav").resolve()),
        "fetched_at": now_iso(),
    }
    write_json(root / "logs" / "00_probe.json", probe)

    run_process(
        root,
        "fetch",
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source_file),
            "-vn",
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            str(root / "audio.wav"),
        ],
    )
    log(root, "fetch", f"出力先: {root}")
    return name


def load_prompt(prompt_file: str | None) -> str | None:
    if not prompt_file:
        return None
    path = Path(prompt_file).expanduser()
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as e:
        raise PipelineError(f"prompt-file がありません: {path}") from e


def write_prompt_log(root: Path, prompt: str | None) -> None:
    prompt = prompt or ""
    too_long = len(prompt) > PROMPT_WARN_CHARS
    with (root / "logs" / "04_prompt.txt").open("w", encoding="utf-8") as f:
        f.write(f"# prompt_chars: {len(prompt)}\n")
        f.write("# prompt_truncated: false\n")
        f.write("# whisper_initial_prompt_limit_note: about 224 tokens\n")
        if too_long:
            f.write(f"# warning: prompt may exceed Whisper initial_prompt limit ({PROMPT_WARN_CHARS} chars heuristic)\n")
        f.write(prompt)
    if too_long:
        print(
            f"警告: initial_prompt は Whisper 側で約224トークンに切られる可能性があります({len(prompt)}文字)。",
            file=sys.stderr,
        )


def cmd_transcribe(args: argparse.Namespace) -> None:
    modules = require_import({"mlx_whisper": "mlx-whisper"})
    mlx_whisper = modules["mlx_whisper"]
    root = project_dir(args.outdir, args.name)
    ensure_dirs(root)
    audio = root / "audio.wav"
    if not audio.exists():
        raise PipelineError(f"audio.wav がありません: {audio}")
    prompt = load_prompt(args.prompt_file)
    if args.prompt_file:
        write_prompt_copy(root, args.prompt_file, prompt or "")
    if args.pass_no == 2:
        write_prompt_log(root, prompt)
    log(root, "transcribe", f"pass{args.pass_no} 開始 model={args.model}")
    result = mlx_whisper.transcribe(
        str(audio),
        path_or_hf_repo=args.model,
        language="ja",
        word_timestamps=True,
        initial_prompt=prompt,
    )
    result["_pipeline"] = {
        "model": args.model,
        "pass": args.pass_no,
        "prompt_chars": len(prompt or ""),
        "prompt_truncated": False,
        "generated_at": now_iso(),
    }
    out = root / "logs" / ("02_whisper_pass1.json" if args.pass_no == 1 else "05_whisper_pass2.json")
    write_json(out, result)
    log(root, "transcribe", f"pass{args.pass_no} 完了 segments={len(result.get('segments', []))}")


def read_wav_mono(path: Path) -> tuple[int, bytes, Any]:
    require_import({"numpy": "numpy"})
    import numpy as np

    with wave.open(str(path), "rb") as wf:
        rate = wf.getframerate()
        channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        frames = wf.readframes(wf.getnframes())
    if rate != 16000 or channels != 1 or sampwidth != 2:
        raise PipelineError("audio.wav は 16kHz mono PCM16 である必要があります。fetch を再実行してください。")
    audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    return rate, frames, audio


def merge_intervals(intervals: list[dict[str, float]], max_gap: float = 0.3, min_dur: float = 0.35) -> list[dict[str, float]]:
    if not intervals:
        return []
    merged = [intervals[0].copy()]
    for it in intervals[1:]:
        last = merged[-1]
        if it["start"] - last["end"] <= max_gap:
            last["end"] = max(last["end"], it["end"])
        else:
            merged.append(it.copy())
    return [it for it in merged if it["end"] - it["start"] >= min_dur]


def vad_webrtc(rate: int, pcm: bytes) -> list[dict[str, float]] | None:
    try:
        import webrtcvad
    except ImportError:
        return None
    vad = webrtcvad.Vad(2)
    frame_ms = 30
    frame_bytes = int(rate * frame_ms / 1000) * 2
    intervals = []
    active_start: float | None = None
    total = len(pcm) // frame_bytes
    for i in range(total):
        chunk = pcm[i * frame_bytes : (i + 1) * frame_bytes]
        t0 = i * frame_ms / 1000.0
        speech = vad.is_speech(chunk, rate)
        if speech and active_start is None:
            active_start = t0
        elif not speech and active_start is not None:
            intervals.append({"start": active_start, "end": t0})
            active_start = None
    if active_start is not None:
        intervals.append({"start": active_start, "end": total * frame_ms / 1000.0})
    return merge_intervals(intervals)


def vad_energy(rate: int, audio: Any) -> list[dict[str, float]]:
    import numpy as np

    frame = int(rate * 0.03)
    if len(audio) < frame:
        return []
    rms = []
    for start in range(0, len(audio) - frame + 1, frame):
        chunk = audio[start : start + frame]
        rms.append(float(np.sqrt(np.mean(chunk * chunk))))
    threshold = max(0.01, float(np.percentile(rms, 65)) * 0.55)
    intervals = []
    active_start: float | None = None
    for i, value in enumerate(rms):
        t0 = i * 0.03
        speech = value >= threshold
        if speech and active_start is None:
            active_start = t0
        elif not speech and active_start is not None:
            intervals.append({"start": active_start, "end": t0})
            active_start = None
    if active_start is not None:
        intervals.append({"start": active_start, "end": len(rms) * 0.03})
    return merge_intervals(intervals)


def speaker_name(index: int) -> str:
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if index < len(alphabet):
        return f"人物{alphabet[index]}"
    return f"人物{index + 1}"


def cmd_diarize(args: argparse.Namespace) -> None:
    require_import({"numpy": "numpy", "resemblyzer": "resemblyzer", "sklearn": "scikit-learn"})
    import numpy as np
    from resemblyzer import VoiceEncoder
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics import silhouette_samples, silhouette_score

    root = project_dir(args.outdir, args.name)
    ensure_dirs(root)
    audio_path = root / "audio.wav"
    if not audio_path.exists():
        raise PipelineError(f"audio.wav がありません: {audio_path}")
    rate, pcm, audio = read_wav_mono(audio_path)
    turns = vad_webrtc(rate, pcm)
    vad_method = "webrtcvad" if turns is not None else "energy"
    if turns is None:
        turns = vad_energy(rate, audio)
    log(root, "diarize", f"VAD 完了 method={vad_method} turns={len(turns)}")

    evidence: dict[str, Any] = {"vad_method": vad_method, "turn_count": len(turns)}
    if len(turns) < 3:
        out_turns = [{**t, "speaker": "人物A", "confidence": 1.0} for t in turns]
        result = {
            "method": "resemblyzer+agglomerative",
            "n_speakers": 1,
            "chose_by": "speech_turn_count",
            "silhouette": None,
            "evidence": {**evidence, "reason": "発話区間が3未満のためクラスタリングしていない", "measured": False},
            "turns": out_turns,
        }
        write_json(root / "logs" / "03_diarization.json", result)
        log(root, "diarize", "1話者として出力: 発話区間が3未満")
        return

    encoder = VoiceEncoder()
    embeddings = []
    valid_turns = []
    for turn in turns:
        start = max(0, int((turn["start"] - 0.05) * rate))
        end = min(len(audio), int((turn["end"] + 0.05) * rate))
        clip = audio[start:end]
        if len(clip) < int(rate * 0.35):
            continue
        embeddings.append(encoder.embed_utterance(clip))
        valid_turns.append(turn)
    if len(valid_turns) < 3:
        out_turns = [{**t, "speaker": "人物A", "confidence": 1.0} for t in valid_turns]
        result = {
            "method": "resemblyzer+agglomerative",
            "n_speakers": 1,
            "chose_by": "embeddable_turn_count",
            "silhouette": None,
            "evidence": {**evidence, "embeddable_turn_count": len(valid_turns), "measured": False},
            "turns": out_turns,
        }
        write_json(root / "logs" / "03_diarization.json", result)
        log(root, "diarize", "1話者として出力: embedding 可能区間が3未満")
        return

    X = np.vstack(embeddings)
    if args.speakers:
        k = max(1, min(args.speakers, len(valid_turns)))
        chose_by = "specified"
        best_score = None
        labels = [0] * len(valid_turns) if k == 1 else AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average").fit_predict(X)
    else:
        max_k = min(6, len(valid_turns) - 1)
        best: tuple[float, int, Any] | None = None
        for k in range(2, max_k + 1):
            current = AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average").fit_predict(X)
            if len(set(current)) < 2:
                continue
            score = float(silhouette_score(X, current, metric="cosine"))
            if best is None or score > best[0]:
                best = (score, k, current)
        if best is None or best[0] < 0.05:
            k = 1
            labels = [0] * len(valid_turns)
            best_score = best[0] if best else None
            chose_by = "silhouette_single_speaker"
        else:
            best_score, k, labels = best
            chose_by = "silhouette"

    labels = list(map(int, labels))
    ordered: dict[int, int] = {}
    for label in labels:
        if label not in ordered:
            ordered[label] = len(ordered)
    speakers = [speaker_name(ordered[label]) for label in labels]
    if len(set(labels)) > 1:
        sample_scores = silhouette_samples(X, labels, metric="cosine")
        confidences = [round(max(0.0, min(1.0, (float(v) + 1.0) / 2.0)), 3) for v in sample_scores]
    else:
        confidences = [1.0] * len(labels)
    out_turns = []
    for turn, speaker, confidence in zip(valid_turns, speakers, confidences, strict=True):
        out_turns.append({"start": round(turn["start"], 3), "end": round(turn["end"], 3), "speaker": speaker, "confidence": confidence})
    result = {
        "method": "resemblyzer+agglomerative",
        "n_speakers": len(set(speakers)),
        "chose_by": chose_by,
        "silhouette": None if best_score is None else round(float(best_score), 4),
        "evidence": {**evidence, "embeddable_turn_count": len(valid_turns), "measured": len(valid_turns) >= 3},
        "turns": out_turns,
    }
    write_json(root / "logs" / "03_diarization.json", result)
    log(root, "diarize", f"完了 speakers={result['n_speakers']} chose_by={chose_by}")


def cmd_normalize(args: argparse.Namespace) -> None:
    """Whisper が取り違えた固有名詞を、規則ファイルで直す。

    固有名詞を initial_prompt に入れると直る誤りと、新しく壊れる誤りの両方が出る
    （実測: 「交野」が prompt 無しでは「カタノ」、prompt ありでは「刀」になった）。
    そこで文字起こしの後段で、置換した件数を必ず記録しながら直す。
    """
    root = project_dir(args.outdir, args.name)
    ensure_dirs(root)
    whisper = read_json(root / "logs" / "05_whisper_pass2.json")

    rules: list[dict[str, Any]] = []
    if args.rules:
        loaded = read_json(Path(args.rules))
        rules = loaded.get("rules", loaded if isinstance(loaded, list) else [])

    applied: list[dict[str, Any]] = []
    total = 0
    segments = whisper.get("segments", [])
    for rule in rules:
        right = rule.get("right", "")
        hits = 0
        for wrong in rule.get("wrong", []):
            if not wrong:
                continue
            for seg in segments:
                text = seg.get("text") or ""
                count = text.count(wrong)
                if count:
                    seg["text"] = text.replace(wrong, right)
                    hits += count
        applied.append({"right": right, "wrong": rule.get("wrong", []), "replaced": hits})
        total += hits

    whisper["text"] = "".join((seg.get("text") or "") for seg in segments)
    write_json(root / "logs" / "05b_whisper_pass2_normalized.json", whisper)
    write_json(
        root / "logs" / "08_normalize.json",
        {
            "rules_file": args.rules,
            "rules_count": len(rules),
            "checked_segments": len(segments),
            "replaced_total": total,
            "applied": applied,
            "reason": None if rules else "規則ファイルが指定されていないため何も置換していない",
            "generated_at": now_iso(),
        },
    )
    log(root, "normalize", f"完了 規則={len(rules)} 置換={total} 対象segments={len(segments)}")


def overlap(a0: float, a1: float, b0: float, b1: float) -> float:
    return max(0.0, min(a1, b1) - max(a0, b0))


def cmd_align(args: argparse.Namespace) -> None:
    root = project_dir(args.outdir, args.name)
    ensure_dirs(root)
    normalized = root / "logs" / "05b_whisper_pass2_normalized.json"
    source = normalized if normalized.exists() else root / "logs" / "05_whisper_pass2.json"
    whisper = read_json(source)
    log(root, "align", f"文字起こしの読み元: {source.name}")
    diar = read_json(root / "logs" / "03_diarization.json")
    turns = diar.get("turns", [])
    aligned = []
    for i, seg in enumerate(whisper.get("segments", [])):
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", start))
        best_speaker = None
        best_overlap = 0.0
        for turn in turns:
            current = overlap(start, end, float(turn["start"]), float(turn["end"]))
            if current > best_overlap:
                best_overlap = current
                best_speaker = turn.get("speaker")
        aligned.append(
            {
                "id": int(seg.get("id", i)),
                "start": round(start, 3),
                "end": round(end, 3),
                "speaker": best_speaker if best_overlap > 0 else None,
                "text": (seg.get("text") or "").strip(),
                "overlap_sec": round(best_overlap, 3),
            }
        )
    write_json(root / "logs" / "06_aligned.json", {"segments": aligned, "generated_at": now_iso()})
    log(root, "align", f"完了 segments={len(aligned)}")


def parse_terms(path: str | None) -> list[str]:
    if not path:
        return DEFAULT_DEICTIC_TERMS[:]
    text = Path(path).expanduser().read_text(encoding="utf-8")
    try:
        value = json.loads(text)
        if isinstance(value, list):
            return [str(v) for v in value if str(v).strip()]
    except json.JSONDecodeError:
        pass
    return [t.strip() for t in re.split(r"[\n,、]+", text) if t.strip()]


def mmss(value: float) -> str:
    total = max(0, int(round(value)))
    return f"{total // 60:02d}{total % 60:02d}"


def clear_scene_images(root: Path) -> int:
    """前回の実行で書き出した静止画を消す。

    消さないと、今回の 07_scenes.json に載っていない古い画像が images/ に残り、
    ディレクトリを見た人が実際より多い件数だと読んでしまう。
    """
    images = root / "images"
    removed = 0
    if images.exists():
        for f in sorted(images.glob("scene_*.jpg")):
            f.unlink()
            removed += 1
    return removed


def cmd_scenes(args: argparse.Namespace) -> None:
    command_exists("ffmpeg")
    root = project_dir(args.outdir, args.name)
    ensure_dirs(root)
    aligned = read_json(root / "logs" / "06_aligned.json")
    terms = parse_terms(args.deictic_file)
    candidates = []
    for seg in aligned.get("segments", []):
        text = seg.get("text") or ""
        matched = [term for term in terms if term in text]
        if matched:
            candidates.append(
                {
                    "time": (float(seg["start"]) + float(seg["end"])) / 2.0,
                    "segment_id": seg["id"],
                    "text": text,
                    "matched": matched,
                }
            )

    if not candidates:
        write_json(
            root / "logs" / "07_scenes.json",
            {
                "scenes": [],
                "reason": "指示語に一致するセグメントが無い",
                "checked_segments": len(aligned.get("segments", [])),
                "deictic_terms": terms,
            },
        )
        removed = clear_scene_images(root)
        log(root, "scenes", f"抽出0件 checked={len(aligned.get('segments', []))} 旧画像削除={removed}")
        return

    merged = []
    for cand in sorted(candidates, key=lambda x: x["time"]):
        if merged and cand["time"] - merged[-1]["time"] <= 1.0:
            merged[-1]["matched"] = sorted(set(merged[-1]["matched"] + cand["matched"]))
            continue
        merged.append(cand)

    video = video_path_from_probe(root)
    removed = clear_scene_images(root)
    if removed:
        log(root, "scenes", f"旧画像を削除しました: {removed}枚")
    scenes = []
    for idx, scene in enumerate(merged, start=1):
        image_rel = f"images/scene_{idx:03d}_{mmss(scene['time'])}.jpg"
        image_abs = root / image_rel
        run_process(
            root,
            "scenes",
            [
                "ffmpeg",
                "-y",
                "-ss",
                f"{scene['time']:.3f}",
                "-i",
                str(video),
                "-frames:v",
                "1",
                "-q:v",
                "2",
                str(image_abs),
            ],
        )
        scenes.append(
            {
                "index": idx,
                "time": round(scene["time"], 3),
                "segment_id": scene["segment_id"],
                "text": scene["text"],
                "matched": scene["matched"],
                "image": image_rel,
            }
        )
    write_json(root / "logs" / "07_scenes.json", {"scenes": scenes, "checked_segments": len(aligned.get("segments", [])), "deictic_terms": terms})
    log(root, "scenes", f"完了 scenes={len(scenes)}")


def speaker_stats(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stats: dict[str, dict[str, Any]] = {}
    for seg in segments:
        speaker = seg.get("speaker")
        if not speaker:
            continue
        item = stats.setdefault(speaker, {"id": speaker, "label": None, "segments": 0, "total_sec": 0.0})
        item["segments"] += 1
        item["total_sec"] += max(0.0, float(seg["end"]) - float(seg["start"]))
    return [{**v, "total_sec": round(v["total_sec"], 3)} for _, v in sorted(stats.items())]


def parse_prompt_meta(root: Path) -> tuple[int, bool]:
    path = root / "logs" / "04_prompt.txt"
    if not path.exists():
        return 0, False
    chars = 0
    truncated = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# prompt_chars:"):
            chars = int(line.split(":", 1)[1].strip())
        elif line.startswith("# prompt_truncated:"):
            truncated = line.split(":", 1)[1].strip().lower() == "true"
        elif not line.startswith("#"):
            break
    return chars, truncated


def fmt_srt_time(value: float) -> str:
    ms = int(round(value * 1000))
    h, rem = divmod(ms, 3600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def fmt_vtt_time(value: float) -> str:
    return fmt_srt_time(value).replace(",", ".")


def subtitle_text(seg: dict[str, Any]) -> str:
    text = seg.get("text", "")
    return f"{seg['speaker']}: {text}" if seg.get("speaker") else text


def write_subtitles(root: Path, segments: list[dict[str, Any]]) -> None:
    srt_lines = []
    vtt_lines = ["WEBVTT", ""]
    for i, seg in enumerate(segments, start=1):
        srt_lines.extend([str(i), f"{fmt_srt_time(seg['start'])} --> {fmt_srt_time(seg['end'])}", subtitle_text(seg), ""])
        vtt_lines.extend([f"{fmt_vtt_time(seg['start'])} --> {fmt_vtt_time(seg['end'])}", subtitle_text(seg), ""])
    (root / "subtitles.srt").write_text("\n".join(srt_lines), encoding="utf-8")
    (root / "subtitles.vtt").write_text("\n".join(vtt_lines), encoding="utf-8")


def write_markdown(root: Path, segments: list[dict[str, Any]], scenes: list[dict[str, Any]]) -> None:
    scene_by_segment = {s["segment_id"]: s for s in scenes}
    lines = [f"# {root.name}", ""]
    for seg in segments:
        speaker = seg.get("speaker") or "話者不明"
        t = fmt_vtt_time(seg["start"])
        suffix = ""
        if seg["id"] in scene_by_segment:
            suffix = f" ![]({scene_by_segment[seg['id']]['image']})"
        lines.append(f"- `{t}` **{speaker}**: {seg.get('text', '')}{suffix}")
    (root / "transcript.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def cmd_emit(args: argparse.Namespace) -> None:
    root = project_dir(args.outdir, args.name)
    ensure_dirs(root)
    probe = read_json(root / "logs" / "00_probe.json")
    pass2 = read_json(root / "logs" / "05_whisper_pass2.json")
    diar = read_json(root / "logs" / "03_diarization.json")
    aligned = read_json(root / "logs" / "06_aligned.json")
    scenes_log = read_json(root / "logs" / "07_scenes.json")
    source = source_from_probe(probe)
    prompt_chars, prompt_truncated = parse_prompt_meta(root)
    scenes = scenes_log.get("scenes", [])
    scene_by_segment = {s["segment_id"]: s["index"] for s in scenes}
    segments = []
    for seg in aligned.get("segments", []):
        segments.append(
            {
                "id": seg["id"],
                "start": seg["start"],
                "end": seg["end"],
                "speaker": seg.get("speaker"),
                "speaker_label": None,
                "text": seg.get("text", ""),
                "scene": scene_by_segment.get(seg["id"]),
            }
        )
    speakers = speaker_stats(segments)
    doc = {
        "schema": "ytdl.transcribe-scenes/1",
        "source": {
            "name": source.get("name") or root.name,
            "url": source.get("url"),
            "file": source.get("file"),
            "duration_sec": duration_from_probe(probe),
            "video": video_shape_from_probe(probe),
            "generated_at": now_iso(),
        },
        "pipeline": {
            "whisper_model": pass2.get("_pipeline", {}).get("model", DEFAULT_MODEL),
            "passes": 2,
            "diarization": {
                "method": diar.get("method"),
                "n_speakers": diar.get("n_speakers"),
                "silhouette": diar.get("silhouette"),
            },
            "prompt_chars": prompt_chars,
            "prompt_truncated": prompt_truncated,
        },
        "speakers": speakers,
        "segments": segments,
        "scenes": [
            {
                "index": s["index"],
                "time": s["time"],
                "segment_id": s["segment_id"],
                "matched": s["matched"],
                "image": s["image"],
            }
            for s in scenes
        ],
    }
    write_json(root / "transcript.json", doc)
    write_json(root / "speakers.json", {"speakers": speakers, "diarization": diar})
    write_subtitles(root, segments)
    write_markdown(root, segments, scenes)
    log(root, "emit", f"完了 segments={len(segments)} scenes={len(scenes)}")


def cmd_run(args: argparse.Namespace) -> None:
    name = cmd_fetch(args)
    root = project_dir(args.outdir, name)
    prompt_file = args.prompt_file
    cmd_transcribe(argparse.Namespace(outdir=args.outdir, name=name, pass_no=1, prompt_file=prompt_file, model=args.model))
    cmd_diarize(argparse.Namespace(outdir=args.outdir, name=name, speakers=args.speakers))
    if not args.prompt_file:
        log(root, "run", "pass2 の --prompt-file 未指定のため pass1 と同じプロンプトを使います: なし")
    cmd_transcribe(argparse.Namespace(outdir=args.outdir, name=name, pass_no=2, prompt_file=prompt_file, model=args.model))
    cmd_normalize(argparse.Namespace(outdir=args.outdir, name=name, rules=args.rules))
    cmd_align(argparse.Namespace(outdir=args.outdir, name=name))
    cmd_scenes(argparse.Namespace(outdir=args.outdir, name=name, deictic_file=args.deictic_file))
    cmd_emit(argparse.Namespace(outdir=args.outdir, name=name))
    log(root, "run", "全工程完了")
    print(str(root))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="動画を文字起こしし、話者と指示語シーンを揃えて出力します。")
    sub = parser.add_subparsers(dest="subcommand", required=True)

    fetch = sub.add_parser("fetch")
    fetch.add_argument("--url")
    fetch.add_argument("--file")
    fetch.add_argument("--outdir", required=True)
    fetch.add_argument("--name")
    fetch.set_defaults(func=cmd_fetch)

    transcribe = sub.add_parser("transcribe")
    transcribe.add_argument("--outdir", required=True)
    transcribe.add_argument("--name", required=True)
    transcribe.add_argument("--pass", dest="pass_no", required=True, type=int, choices=[1, 2])
    transcribe.add_argument("--prompt-file")
    transcribe.add_argument("--model", default=DEFAULT_MODEL)
    transcribe.set_defaults(func=cmd_transcribe)

    diarize = sub.add_parser("diarize")
    diarize.add_argument("--outdir", required=True)
    diarize.add_argument("--name", required=True)
    diarize.add_argument("--speakers", type=int)
    diarize.set_defaults(func=cmd_diarize)

    align = sub.add_parser("align")
    align.add_argument("--outdir", required=True)
    align.add_argument("--name", required=True)
    align.set_defaults(func=cmd_align)

    normalize = sub.add_parser("normalize")
    normalize.add_argument("--outdir", required=True)
    normalize.add_argument("--name", required=True)
    normalize.add_argument("--rules", help="同音異義語の置換規則 JSON")
    normalize.set_defaults(func=cmd_normalize)

    scenes = sub.add_parser("scenes")
    scenes.add_argument("--outdir", required=True)
    scenes.add_argument("--name", required=True)
    scenes.add_argument("--deictic-file")
    scenes.set_defaults(func=cmd_scenes)

    emit = sub.add_parser("emit")
    emit.add_argument("--outdir", required=True)
    emit.add_argument("--name", required=True)
    emit.set_defaults(func=cmd_emit)

    run = sub.add_parser("run")
    run.add_argument("--url")
    run.add_argument("--file")
    run.add_argument("--outdir", required=True)
    run.add_argument("--name")
    run.add_argument("--prompt-file")
    run.add_argument("--speakers", type=int)
    run.add_argument("--deictic-file")
    run.add_argument("--rules", help="同音異義語の置換規則 JSON")
    run.add_argument("--model", default=DEFAULT_MODEL)
    run.set_defaults(func=cmd_run)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = args.func(args)
        if args.subcommand == "fetch" and result:
            print(result)
        return 0
    except PipelineError as e:
        print(f"エラー: {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("中断しました", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
