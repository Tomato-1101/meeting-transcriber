"""Phase 1 限定の旧データ救出エンドポイント。

新仕様（クライアント保存）に切り替えると同時に削除する。
全 Transcription / AIResult / ChatMessage を新フォーマット JSON で返す。
新フォーマット = フロントの「Load history」がそのまま読める形。
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.ai_result import AIResult
from app.models.job import Job
from app.models.transcription import Transcription

router = APIRouter(tags=["admin_export"])


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


@router.get("/admin/export-all")
async def export_all(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Transcription)
        .options(
            selectinload(Transcription.segments),
            selectinload(Transcription.job),
            selectinload(Transcription.ai_results).selectinload(AIResult.chat_messages),
        )
        .order_by(Transcription.created_at.desc())
    )
    transcriptions = result.scalars().all()

    out = []
    for t in transcriptions:
        job: Job | None = t.job
        filename = job.original_filename if job else "audio"
        out.append(
            {
                "id": t.id,
                "filename": filename,
                "model_used": t.model_used,
                "language_detected": t.language_detected,
                "duration_seconds": t.duration_seconds,
                "full_text": t.full_text,
                "created_at": _iso(t.created_at),
                "segments": [
                    {
                        "speaker": s.speaker,
                        "text": s.text,
                        "start_time": s.start_time,
                        "end_time": s.end_time,
                        "chunk_index": s.chunk_index,
                        "sequence_order": s.sequence_order,
                    }
                    for s in t.segments
                ],
                "ai_results": [
                    {
                        "id": r.id,
                        "result_type": r.result_type,
                        "model_used": r.model_used,
                        "prompt_used": r.prompt_used,
                        "result_text": r.result_text,
                        "created_at": _iso(r.created_at),
                        "chat_messages": [
                            {
                                "role": m.role,
                                "content": m.content,
                                "model_used": m.model_used,
                                "sequence_order": m.sequence_order,
                                "created_at": _iso(m.created_at),
                            }
                            for m in sorted(
                                r.chat_messages, key=lambda x: x.sequence_order
                            )
                        ],
                    }
                    for r in t.ai_results
                ],
            }
        )

    return {"version": 1, "transcriptions": out}
