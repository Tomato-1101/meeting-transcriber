"""ステートレスな文字起こし処理。

DB は介さず、進捗イベントを `job_progress` に emit する。
完了時 `stage="completed"` で `result` (full_text + segments + meta) を含めて送る。
失敗時 `stage="failed"` で `error` を送る。
作業用ディレクトリ (work_dir) は呼び出し側で finally 削除する。
"""
import asyncio
from pathlib import Path

from app.services.audio_processor import (
    probe_audio, should_chunk, chunk_audio, cleanup_chunks, ChunkInfo,
)
from app.services.audio_preprocessor import preprocess_audio
from app.services.openai_client import transcribe_audio
from app.utils.job_manager import job_progress
from app.utils.logger import logger


async def process_transcription_request(
    job_id: str,
    audio_path: Path,
    work_dir: Path,
    model: str,
    language: str | None,
    preprocess_profile: str,
    filename: str,
):
    try:
        # Stage 1: Probe
        job_progress.update(job_id, "probing", 0.05)
        info = await probe_audio(audio_path)
        duration_seconds = info.duration_seconds

        # Stage 2: Preprocess (noise reduction + VAD silence trim + compress)
        job_progress.update(job_id, "preprocessing", 0.10)
        compressed_path = work_dir / f"{job_id}_compressed.mp3"
        preprocess_result = await preprocess_audio(
            audio_path, compressed_path, profile=preprocess_profile,
        )
        compressed_info = await probe_audio(compressed_path)
        logger.info(
            f"Preprocessed: {info.file_size_bytes/1024/1024:.1f}MB -> "
            f"{compressed_info.file_size_bytes/1024/1024:.1f}MB, "
            f"課金分数 {info.duration_seconds/60:.1f}min -> {preprocess_result.processed_duration_s/60:.1f}min "
            f"({preprocess_result.reduction_percent():.1f}%削減)"
        )

        # Stage 3: Chunk if needed
        chunk_dir = work_dir / "chunks"
        if should_chunk(compressed_path, compressed_info.duration_seconds):
            job_progress.update(job_id, "chunking", 0.15)
            chunk_result = await chunk_audio(compressed_path, chunk_dir)
            chunks = chunk_result.chunks
            num_chunks = len(chunks)
            logger.info(
                f"Split into {num_chunks} chunks "
                f"(method: {chunk_result.split_method}, "
                f"silences: {chunk_result.total_silence_count} detected, "
                f"{chunk_result.used_silence_count} used for splitting)"
            )
        else:
            chunks = [ChunkInfo(
                file_path=compressed_path,
                offset_ms=0,
                index=0,
                duration_ms=int(compressed_info.duration_seconds * 1000),
            )]
            num_chunks = 1
            logger.info("Audio is short enough, no chunking needed (single chunk)")

        # Stage 4: Transcribe
        job_progress.update(job_id, "transcribing", 0.20, total_chunks=num_chunks)

        semaphore = asyncio.Semaphore(3)

        async def transcribe_chunk(chunk: ChunkInfo) -> dict:
            async with semaphore:
                result = await transcribe_audio(
                    chunk.file_path, model=model, language=language,
                )
                progress = 0.20 + 0.65 * (chunk.index + 1) / num_chunks
                job_progress.update(
                    job_id, "transcribing", progress,
                    chunk=chunk.index + 1, total_chunks=num_chunks,
                )
                return {"result": result, "chunk": chunk}

        chunk_results = await asyncio.gather(
            *[transcribe_chunk(c) for c in chunks]
        )
        chunk_results.sort(key=lambda x: x["chunk"].index)

        # Stage 5: Merge
        job_progress.update(job_id, "merging", 0.90)
        merged = _merge_results(chunk_results)

        # Stage 6: Done — payload をクライアントに渡す
        result_payload = {
            "filename": filename,
            "full_text": merged["text"],
            "segments": merged["segments"],
            "model_used": model,
            "language_detected": merged.get("language"),
            "duration_seconds": duration_seconds,
        }
        job_progress.update(
            job_id, "completed", 1.0,
            total_chunks=num_chunks,
            result=result_payload,
        )
        logger.info(f"Job {job_id} completed: {len(merged['segments'])} segments")

        # Cleanup chunks（compressed_path は work_dir の TemporaryDirectory ごと消える）
        cleanup_chunks(chunk_dir)

    except Exception as e:
        logger.exception(f"Job {job_id} failed: {e}")
        job_progress.update(job_id, "failed", 0.0, error=str(e))


def _merge_results(chunk_results: list[dict]) -> dict:
    all_text_parts = []
    all_segments = []
    language = None
    global_order = 0

    for cr in chunk_results:
        result = cr["result"]
        chunk: ChunkInfo = cr["chunk"]
        offset_s = chunk.offset_ms / 1000.0

        all_text_parts.append(result["text"])
        if not language and result.get("language"):
            language = result["language"]

        for seg in result.get("segments", []):
            all_segments.append({
                "speaker": seg.get("speaker"),
                "text": seg["text"],
                "start_time": seg["start_time"] + offset_s,
                "end_time": seg["end_time"] + offset_s,
                "chunk_index": chunk.index,
                "sequence_order": global_order,
            })
            global_order += 1

    return {
        "text": "\n".join(all_text_parts),
        "segments": all_segments,
        "language": language,
    }
