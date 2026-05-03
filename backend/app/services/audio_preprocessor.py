"""音声前処理: ノイズ低減 + VAD ベースの無音カット + 16kHz mono 圧縮。

目的:
- OpenAI Whisper API は分単位課金なので、無音区間を物理的に削ることで課金分数を直接削減する。
- 同時に背景の定常ノイズを noisereduce で抑え、誤認識リトライを減らす。
"""
import asyncio
import json
import subprocess
from dataclasses import dataclass, asdict
from pathlib import Path

from app.utils.logger import logger

# silero-vad モデルはプロセス全体で1回だけロード（CPU 上で数MB）
_VAD_MODEL = None
_VAD_UTILS = None
_VAD_LOAD_LOCK = asyncio.Lock()

VAD_SAMPLE_RATE = 16000
VAD_PADDING_MS = 200       # 発話区間の前後に付ける余白
VAD_MIN_SILENCE_MS = 500   # この長さ未満の無音は隣接区間と統合


@dataclass
class PreprocessResult:
    original_duration_s: float
    processed_duration_s: float
    removed_silence_s: float
    noise_reduced: bool
    profile: str

    def reduction_percent(self) -> float:
        if self.original_duration_s <= 0:
            return 0.0
        return 100.0 * (self.original_duration_s - self.processed_duration_s) / self.original_duration_s

    def to_json(self) -> str:
        d = asdict(self)
        d["reduction_percent"] = round(self.reduction_percent(), 2)
        return json.dumps(d, ensure_ascii=False)


async def _load_vad():
    global _VAD_MODEL, _VAD_UTILS
    if _VAD_MODEL is not None:
        return _VAD_MODEL, _VAD_UTILS
    async with _VAD_LOAD_LOCK:
        if _VAD_MODEL is not None:
            return _VAD_MODEL, _VAD_UTILS

        def _load():
            import torch
            torch.set_num_threads(1)
            model, utils = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                trust_repo=True,
            )
            return model, utils

        logger.info("Loading silero-vad model (one-time download on first run)")
        _VAD_MODEL, _VAD_UTILS = await asyncio.to_thread(_load)
        logger.info("silero-vad loaded")
    return _VAD_MODEL, _VAD_UTILS


async def preprocess_audio(
    input_path: Path,
    output_path: Path,
    profile: str = "standard",
) -> PreprocessResult:
    """profile:
    - "standard": noisereduce + VAD + 無音カット + 圧縮
    - "raw": 何もせず ffmpeg で 16kHz mono 64kbps に変換だけ
    - "aggressive": "standard" と同じだが余白を短くする
    """
    if profile == "raw":
        return await _passthrough_compress(input_path, output_path)

    padding_ms = 100 if profile == "aggressive" else VAD_PADDING_MS

    def _process():
        import numpy as np
        import soundfile as sf
        import torch
        from pydub import AudioSegment
        import noisereduce as nr

        audio = AudioSegment.from_file(str(input_path))
        original_duration_s = len(audio) / 1000.0
        audio = audio.set_channels(1).set_frame_rate(VAD_SAMPLE_RATE)

        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
        max_val = float(1 << (8 * audio.sample_width - 1))
        samples /= max_val

        try:
            samples = nr.reduce_noise(
                y=samples,
                sr=VAD_SAMPLE_RATE,
                stationary=True,
                prop_decrease=0.7,
            )
            noise_reduced = True
        except Exception as e:
            logger.warning(f"noisereduce failed, continuing without it: {e}")
            noise_reduced = False

        return samples, original_duration_s, noise_reduced

    samples, original_duration_s, noise_reduced = await asyncio.to_thread(_process)

    model, utils = await _load_vad()

    def _vad():
        import torch
        get_speech_timestamps = utils[0]
        tensor = torch.from_numpy(samples).float()
        timestamps = get_speech_timestamps(
            tensor,
            model,
            sampling_rate=VAD_SAMPLE_RATE,
            min_silence_duration_ms=VAD_MIN_SILENCE_MS,
            speech_pad_ms=padding_ms,
        )
        return timestamps

    timestamps = await asyncio.to_thread(_vad)

    if not timestamps:
        logger.warning("VAD detected no speech; falling back to raw compression")
        return await _passthrough_compress(input_path, output_path)

    def _stitch_and_export():
        import numpy as np
        import soundfile as sf
        chunks = [samples[ts["start"]:ts["end"]] for ts in timestamps]
        stitched = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
        wav_path = output_path.with_suffix(".wav")
        sf.write(str(wav_path), stitched, VAD_SAMPLE_RATE, subtype="PCM_16")
        return wav_path, len(stitched) / VAD_SAMPLE_RATE

    wav_path, processed_duration_s = await asyncio.to_thread(_stitch_and_export)

    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-i", str(wav_path),
        "-ac", "1", "-ab", "64k", "-ar", str(VAD_SAMPLE_RATE),
        "-f", "mp3", str(output_path),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    wav_path.unlink(missing_ok=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {stderr.decode()[-500:]}")

    result = PreprocessResult(
        original_duration_s=original_duration_s,
        processed_duration_s=processed_duration_s,
        removed_silence_s=max(0.0, original_duration_s - processed_duration_s),
        noise_reduced=noise_reduced,
        profile=profile,
    )
    logger.info(
        f"Preprocess({profile}): {original_duration_s:.1f}s -> {processed_duration_s:.1f}s "
        f"(削減 {result.reduction_percent():.1f}%, ノイズ低減: {noise_reduced})"
    )
    return result


async def _passthrough_compress(input_path: Path, output_path: Path) -> PreprocessResult:
    """前処理せず ffmpeg で形式変換するだけ。"""
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "quiet", "-print_format", "json", "-show_format",
        str(input_path),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    try:
        info = json.loads(stdout)
        duration = float(info.get("format", {}).get("duration", 0))
    except Exception:
        duration = 0.0

    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-i", str(input_path),
        "-ac", "1", "-ab", "64k", "-ar", str(VAD_SAMPLE_RATE),
        "-f", "mp3", str(output_path),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {stderr.decode()[-500:]}")

    return PreprocessResult(
        original_duration_s=duration,
        processed_duration_s=duration,
        removed_silence_s=0.0,
        noise_reduced=False,
        profile="raw",
    )
