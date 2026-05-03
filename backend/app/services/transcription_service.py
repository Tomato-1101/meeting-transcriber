import asyncio
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.job import Job
from app.models.transcription import Transcription, Segment
from app.services.audio_processor import (
    probe_audio, should_chunk, chunk_audio, cleanup_chunks, ChunkInfo, ChunkResult,
)
from app.services.audio_preprocessor import preprocess_audio
from app.services.openai_client import transcribe_audio
from app.utils.job_manager import job_progress
from app.utils.logger import logger
from app.config import UPLOADS_DIR


async def process_transcription_job(job_id: str):
    async with async_session() as db:
        job = await db.get(Job, job_id)
        if not job:
            logger.error(f"Job {job_id} not found")
            return

        try:
            original_path = Path(job.original_file_path)

            # Stage 1: Probe
            job_progress.update(job_id, "probing", 0.05)
            info = await probe_audio(original_path)
            job.duration_seconds = info.duration_seconds
            await db.commit()

            # Stage 2: Preprocess (noise reduction + VAD silence trim + compress)
            job_progress.update(job_id, "preprocessing", 0.10)
            compressed_path = UPLOADS_DIR / f"{job_id}_compressed.mp3"
            profile = getattr(job, "preprocess_profile", "standard") or "standard"
            preprocess_result = await preprocess_audio(
                original_path, compressed_path, profile=profile,
            )
            job.preprocess_stats = preprocess_result.to_json()
            await db.commit()
            compressed_info = await probe_audio(compressed_path)
            logger.info(
                f"Preprocessed: {info.file_size_bytes/1024/1024:.1f}MB -> "
                f"{compressed_info.file_size_bytes/1024/1024:.1f}MB, "
                f"課金分数 {info.duration_seconds/60:.1f}min -> {preprocess_result.processed_duration_s/60:.1f}min "
                f"({preprocess_result.reduction_percent():.1f}%削減)"
            )

            # Stage 3: Chunk if needed
            if should_chunk(compressed_path, compressed_info.duration_seconds):
                job_progress.update(job_id, "chunking", 0.15)
                job.status = "chunking"
                await db.commit()
                chunk_result = await chunk_audio(compressed_path, job_id)
                chunks = chunk_result.chunks
                job.num_chunks = len(chunks)
                await db.commit()
                logger.info(
                    f"Split into {len(chunks)} chunks "
                    f"(method: {chunk_result.split_method}, "
                    f"silences: {chunk_result.total_silence_count} detected, "
                    f"{chunk_result.used_silence_count} used for splitting)"
                )
            else:
                chunks = [ChunkInfo(file_path=compressed_path, offset_ms=0, index=0, duration_ms=int(compressed_info.duration_seconds * 1000))]
                job.num_chunks = 1
                await db.commit()
                logger.info("Audio is short enough, no chunking needed (single chunk)")

            # Stage 4: Transcribe
            job.status = "transcribing"
            await db.commit()
            job_progress.update(job_id, "transcribing", 0.20)

            semaphore = asyncio.Semaphore(3)

            async def transcribe_chunk(chunk: ChunkInfo) -> dict:
                async with semaphore:
                    result = await transcribe_audio(
                        chunk.file_path, model=job.model, language=job.language
                    )
                    progress = 0.20 + 0.65 * (chunk.index + 1) / len(chunks)
                    job_progress.update(
                        job_id, "transcribing", progress,
                        chunk=chunk.index + 1, total_chunks=len(chunks),
                    )
                    return {"result": result, "chunk": chunk}

            chunk_results = await asyncio.gather(
                *[transcribe_chunk(c) for c in chunks]
            )
            chunk_results.sort(key=lambda x: x["chunk"].index)

            # Stage 5: Merge
            job_progress.update(job_id, "merging", 0.90)
            job.status = "merging"
            await db.commit()

            merged = _merge_results(chunk_results)

            # Stage 6: Save
            job_progress.update(job_id, "saving", 0.95)
            transcription = Transcription(
                job_id=job_id,
                full_text=merged["text"],
                model_used=job.model,
                language_detected=merged.get("language"),
                duration_seconds=job.duration_seconds or 0.0,
            )
            db.add(transcription)
            await db.flush()

            for seg_data in merged["segments"]:
                segment = Segment(
                    transcription_id=transcription.id,
                    speaker=seg_data.get("speaker"),
                    text=seg_data["text"],
                    start_time=seg_data["start_time"],
                    end_time=seg_data["end_time"],
                    chunk_index=seg_data.get("chunk_index", 0),
                    sequence_order=seg_data["sequence_order"],
                )
                db.add(segment)

            job.status = "completed"
            job.progress = 1.0
            await db.commit()

            job_progress.update(job_id, "completed", 1.0, transcription_id=transcription.id)
            logger.info(f"Job {job_id} completed: {len(merged['segments'])} segments")

            # Cleanup
            cleanup_chunks(job_id)
            compressed_path.unlink(missing_ok=True)

        except Exception as e:
            logger.exception(f"Job {job_id} failed: {e}")
            job.status = "failed"
            job.error_message = str(e)
            await db.commit()
            job_progress.update(job_id, "failed", job.progress, error=str(e))


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
