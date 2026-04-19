import asyncio
import json
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sse_starlette.sse import EventSourceResponse

from app.database import get_db
from app.models.job import Job
from app.models.transcription import Transcription
from app.schemas.job import JobResponse, JobListResponse
from app.services.transcription_service import process_transcription_job
from app.utils.job_manager import job_progress
from app.config import UPLOADS_DIR, SUPPORTED_AUDIO_FORMATS, MAX_UPLOAD_SIZE_MB

router = APIRouter(tags=["jobs"])


@router.post("/jobs", response_model=JobResponse)
async def create_job(
    file: UploadFile = File(...),
    model: str = Form(...),
    language: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_AUDIO_FORMATS:
        raise HTTPException(400, f"Unsupported format: {ext}. Supported: {', '.join(SUPPORTED_AUDIO_FORMATS)}")

    if model not in ("gpt-4o-mini-transcribe", "gpt-4o-transcribe", "gpt-4o-transcribe-diarize"):
        raise HTTPException(400, f"Unsupported model: {model}")

    job = Job(
        original_filename=file.filename,
        original_file_path="",
        file_size_bytes=0,
        model=model,
        language=language if language else None,
        status="uploading",
    )
    db.add(job)
    await db.flush()

    file_path = UPLOADS_DIR / f"{job.id}{ext}"
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        await db.rollback()
        raise HTTPException(400, f"File too large. Max: {MAX_UPLOAD_SIZE_MB}MB")

    file_path.write_bytes(content)
    job.original_file_path = str(file_path)
    job.file_size_bytes = file_size
    job.status = "processing"
    await db.commit()
    await db.refresh(job)

    asyncio.create_task(process_transcription_job(job.id))

    return _job_to_response(job, transcription_id=None)


@router.get("/jobs", response_model=JobListResponse)
async def list_jobs(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    count_result = await db.execute(select(func.count(Job.id)))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Job)
        .options(selectinload(Job.transcription))
        .order_by(Job.created_at.desc())
        .offset(skip).limit(limit)
    )
    jobs = result.scalars().all()

    return JobListResponse(
        jobs=[_job_to_response(j) for j in jobs],
        total=total,
    )


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Job).options(selectinload(Job.transcription)).where(Job.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    return _job_to_response(job)


@router.get("/jobs/{job_id}/stream")
async def stream_job_progress(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    queue = job_progress.subscribe(job_id)

    async def event_generator():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield {"event": "progress", "data": json.dumps(event)}
                    if event.get("stage") in ("completed", "failed"):
                        break
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": ""}
        finally:
            job_progress.unsubscribe(job_id, queue)

    return EventSourceResponse(event_generator())


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    file_path = Path(job.original_file_path)
    if file_path.exists():
        file_path.unlink()

    await db.delete(job)
    await db.commit()
    return {"status": "deleted"}


_UNSET = object()

def _job_to_response(job: Job, transcription_id=_UNSET) -> JobResponse:
    if transcription_id is _UNSET:
        trans_id = job.transcription.id if job.transcription else None
    else:
        trans_id = transcription_id
    return JobResponse(
        id=job.id,
        status=job.status,
        original_filename=job.original_filename,
        file_size_bytes=job.file_size_bytes,
        duration_seconds=job.duration_seconds,
        model=job.model,
        language=job.language,
        num_chunks=job.num_chunks,
        progress=job.progress,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at,
        transcription_id=trans_id,
    )
