"""ステートレス文字起こしエンドポイント。

POST /api/transcribe → 一時 job_id を発行 + バックグラウンドで処理開始 + tempdir に保存
GET /api/transcribe/{job_id}/stream → SSE で進捗と結果ペイロードを流す

サーバには何も永続化しない。クライアントが SSE の completed イベントから result を受け取り、
自分の React state（必要なら Download で JSON ファイルへ）に保存する。
"""
import asyncio
import json
import re
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.config import (
    MAX_UPLOAD_SIZE_MB, SUPPORTED_AUDIO_FORMATS, TEMP_BASE,
)
from app.services.transcription_service import process_transcription_request
from app.utils.job_manager import job_progress
from app.utils.logger import logger

router = APIRouter(tags=["transcribe"])


ALLOWED_PREPROCESS_PROFILES = {"standard", "raw", "aggressive"}
ALLOWED_MODELS = {
    "gpt-4o-mini-transcribe", "gpt-4o-transcribe", "gpt-4o-transcribe-diarize",
}

_FILENAME_SAFE = re.compile(r"[^A-Za-z0-9_.\- ()ぁ-んァ-ヶ一-龯]")


def _safe_filename(name: str, fallback: str = "audio") -> str:
    base = Path(name).name
    cleaned = _FILENAME_SAFE.sub("_", base).strip()
    cleaned = cleaned[:200]
    return cleaned or fallback


async def _run_and_cleanup(
    job_id: str, audio_path: Path, work_dir: Path,
    model: str, language: str | None, preprocess_profile: str, filename: str,
):
    """transcription を回した後、tempdir を必ず削除する wrapper。"""
    try:
        await process_transcription_request(
            job_id=job_id,
            audio_path=audio_path,
            work_dir=work_dir,
            model=model,
            language=language,
            preprocess_profile=preprocess_profile,
            filename=filename,
        )
    finally:
        # 元の音声ファイルと chunks/compressed すべてを含む tempdir を一括削除
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)
        logger.info(f"Job {job_id}: cleaned up {work_dir}")


@router.post("/transcribe")
async def start_transcribe(
    file: UploadFile = File(...),
    model: str = Form(...),
    language: str | None = Form(None),
    preprocess_profile: str = Form("standard"),
):
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_AUDIO_FORMATS:
        raise HTTPException(
            400,
            f"Unsupported format: {ext}. Supported: {', '.join(SUPPORTED_AUDIO_FORMATS)}",
        )
    if model not in ALLOWED_MODELS:
        raise HTTPException(400, f"Unsupported model: {model}")
    if preprocess_profile not in ALLOWED_PREPROCESS_PROFILES:
        raise HTTPException(
            400, f"Unsupported preprocess_profile: {preprocess_profile}"
        )

    safe_name = _safe_filename(file.filename, fallback=f"audio{ext}")
    job_id = str(uuid.uuid4())

    # この job 用の tempdir を確保（処理終了後にまるごと削除）
    work_dir = Path(tempfile.mkdtemp(prefix=f"mt_{job_id}_", dir=str(TEMP_BASE) if TEMP_BASE else None))
    audio_path = work_dir / f"upload{ext}"

    max_bytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024
    file_size = 0
    try:
        with audio_path.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > max_bytes:
                    raise HTTPException(
                        400, f"File too large. Max: {MAX_UPLOAD_SIZE_MB}MB"
                    )
                out.write(chunk)
    except HTTPException:
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)
        raise
    except Exception:
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)
        raise

    asyncio.create_task(
        _run_and_cleanup(
            job_id=job_id,
            audio_path=audio_path,
            work_dir=work_dir,
            model=model,
            language=language,
            preprocess_profile=preprocess_profile,
            filename=safe_name,
        )
    )

    return {"job_id": job_id, "filename": safe_name}


@router.get("/transcribe/{job_id}/stream")
async def stream_progress(job_id: str):
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
            # 受信が一通り終わったら job_progress 内のメモリも掃除
            job_progress.cleanup(job_id)

    return EventSourceResponse(event_generator())
