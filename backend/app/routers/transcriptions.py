import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.transcription import Transcription, Segment
from app.schemas.transcription import TranscriptionResponse
from app.services.export_service import export_as_text, export_as_json

router = APIRouter(tags=["transcriptions"])


@router.get("/transcriptions/{transcription_id}", response_model=TranscriptionResponse)
async def get_transcription(transcription_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Transcription)
        .options(selectinload(Transcription.segments))
        .where(Transcription.id == transcription_id)
    )
    transcription = result.scalar_one_or_none()
    if not transcription:
        raise HTTPException(404, "Transcription not found")
    return transcription


@router.get("/transcriptions/{transcription_id}/export")
async def export_transcription(
    transcription_id: str,
    format: str = Query("text", pattern="^(text|json)$"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transcription)
        .options(selectinload(Transcription.segments))
        .where(Transcription.id == transcription_id)
    )
    transcription = result.scalar_one_or_none()
    if not transcription:
        raise HTTPException(404, "Transcription not found")

    if format == "json":
        data = export_as_json(transcription)
        return JSONResponse(content=data)
    else:
        text = export_as_text(transcription)
        return PlainTextResponse(content=text)
