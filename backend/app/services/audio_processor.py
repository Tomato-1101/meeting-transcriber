import asyncio
import subprocess
import json
from pathlib import Path
from dataclasses import dataclass

from app.config import CHUNKS_DIR, CHUNK_TARGET_DURATION_MS, CHUNK_MAX_FILE_SIZE_MB, CHUNK_MAX_DURATION_S
from app.utils.logger import logger


@dataclass
class AudioInfo:
    duration_seconds: float
    file_size_bytes: int
    format_name: str
    sample_rate: int
    channels: int


@dataclass
class ChunkResult:
    chunks: list["ChunkInfo"]
    total_silence_count: int
    used_silence_count: int
    split_method: str  # "silence" or "fixed"


@dataclass
class ChunkInfo:
    file_path: Path
    offset_ms: int
    index: int
    duration_ms: int


async def probe_audio(file_path: Path) -> AudioInfo:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams",
        str(file_path),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    data = json.loads(stdout)
    fmt = data.get("format", {})
    audio_stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), {})
    return AudioInfo(
        duration_seconds=float(fmt.get("duration", 0)),
        file_size_bytes=int(fmt.get("size", 0)),
        format_name=fmt.get("format_name", "unknown"),
        sample_rate=int(audio_stream.get("sample_rate", 44100)),
        channels=int(audio_stream.get("channels", 1)),
    )


async def compress_audio(input_path: Path, output_path: Path) -> Path:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-i", str(input_path),
        "-ac", "1", "-ab", "64k", "-ar", "16000",
        "-f", "mp3", str(output_path),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg compression failed: {stderr.decode()}")
    return output_path


def should_chunk(file_path: Path, duration_seconds: float) -> bool:
    file_size_mb = file_path.stat().st_size / (1024 * 1024)
    return file_size_mb > CHUNK_MAX_FILE_SIZE_MB or duration_seconds > CHUNK_MAX_DURATION_S


async def chunk_audio(file_path: Path, job_id: str) -> ChunkResult:
    from pydub import AudioSegment
    from pydub.silence import detect_silence

    logger.info(f"Loading audio for chunking: {file_path}")
    audio = await asyncio.to_thread(AudioSegment.from_file, str(file_path))
    total_ms = len(audio)

    logger.info(f"Detecting silence windows in {total_ms/1000:.1f}s ({total_ms}ms) audio")
    logger.info(f"Parameters: min_silence_len=700ms, silence_thresh=-40dBFS")
    silences = await asyncio.to_thread(
        detect_silence, audio, min_silence_len=700, silence_thresh=-40
    )

    total_silence_count = len(silences)
    logger.info(f"Silence detection: {total_silence_count} silent regions found")
    for i, (s_start, s_end) in enumerate(silences[:10]):
        logger.info(f"  Silence #{i+1}: {s_start/1000:.1f}s - {s_end/1000:.1f}s (duration: {(s_end-s_start)/1000:.1f}s)")
    if total_silence_count > 10:
        logger.info(f"  ... and {total_silence_count - 10} more")

    split_points = [0]
    used_silence_indices = []
    for idx, (silence_start, silence_end) in enumerate(silences):
        midpoint = (silence_start + silence_end) // 2
        if midpoint - split_points[-1] >= CHUNK_TARGET_DURATION_MS:
            split_points.append(midpoint)
            used_silence_indices.append(idx)

    split_method = "silence"
    if len(split_points) == 1 and total_ms > CHUNK_TARGET_DURATION_MS:
        logger.info("No suitable silence points for splitting, using fixed-duration splits (15min intervals)")
        split_points = list(range(0, total_ms, CHUNK_TARGET_DURATION_MS))
        split_method = "fixed"

    split_points.append(total_ms)
    used_silence_count = len(used_silence_indices)

    logger.info(f"Split method: {split_method}")
    logger.info(f"Split points: {len(split_points) - 1} chunks from {len(split_points)} points")
    logger.info(f"Silences used for splitting: {used_silence_count}/{total_silence_count}")
    logger.info(f"Target chunk duration: {CHUNK_TARGET_DURATION_MS/1000/60:.0f} minutes")

    chunk_dir = CHUNKS_DIR / job_id
    chunk_dir.mkdir(parents=True, exist_ok=True)

    chunks = []
    for i in range(len(split_points) - 1):
        start_ms = split_points[i]
        end_ms = split_points[i + 1]
        chunk_audio_seg = audio[start_ms:end_ms]
        chunk_path = chunk_dir / f"chunk_{i:03d}.mp3"
        await asyncio.to_thread(chunk_audio_seg.export, str(chunk_path), format="mp3", parameters=["-ac", "1", "-ab", "64k"])
        chunk_size_mb = chunk_path.stat().st_size / (1024 * 1024)
        chunks.append(ChunkInfo(
            file_path=chunk_path,
            offset_ms=start_ms,
            index=i,
            duration_ms=end_ms - start_ms,
        ))
        logger.info(f"Chunk {i}: {start_ms/1000:.1f}s - {end_ms/1000:.1f}s ({(end_ms-start_ms)/1000:.1f}s, {chunk_size_mb:.1f}MB)")

    return ChunkResult(
        chunks=chunks,
        total_silence_count=total_silence_count,
        used_silence_count=used_silence_count,
        split_method=split_method,
    )


def cleanup_chunks(job_id: str):
    import shutil
    chunk_dir = CHUNKS_DIR / job_id
    if chunk_dir.exists():
        shutil.rmtree(chunk_dir)
