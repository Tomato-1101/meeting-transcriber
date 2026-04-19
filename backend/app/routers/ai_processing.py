from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.transcription import Transcription
from app.models.ai_result import AIResult
from app.schemas.ai_result import AIProcessRequest, AIResultResponse
from app.services.ai_service import run_ai_processing, PROMPTS

router = APIRouter(tags=["ai_processing"])


@router.post("/transcriptions/{transcription_id}/ai", response_model=AIResultResponse)
async def trigger_ai_processing(
    transcription_id: str,
    request: AIProcessRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transcription).where(Transcription.id == transcription_id)
    )
    transcription = result.scalar_one_or_none()
    if not transcription:
        raise HTTPException(404, "Transcription not found")

    allowed_models = {"gemini-2.5-flash", "gemini-2.5-flash-lite", "gpt-4.1-mini", "gpt-4.1-nano"}
    if request.model not in allowed_models:
        raise HTTPException(400, f"Unsupported model: {request.model}")

    allowed_types = set(PROMPTS.keys()) | {"custom"}
    if request.result_type not in allowed_types:
        raise HTTPException(400, f"Unsupported result type: {request.result_type}")

    if request.result_type == "custom" and not request.custom_prompt:
        raise HTTPException(400, "custom_prompt is required for custom result type")

    result_text = await run_ai_processing(
        full_text=transcription.full_text,
        result_type=request.result_type,
        model=request.model,
        custom_prompt=request.custom_prompt,
    )

    prompt_used = request.custom_prompt or PROMPTS.get(request.result_type, "")
    ai_result = AIResult(
        transcription_id=transcription_id,
        result_type=request.result_type,
        prompt_used=prompt_used,
        model_used=request.model,
        result_text=result_text,
    )
    db.add(ai_result)
    await db.commit()
    await db.refresh(ai_result)

    return ai_result


@router.get("/transcriptions/{transcription_id}/ai", response_model=list[AIResultResponse])
async def list_ai_results(
    transcription_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIResult)
        .where(AIResult.transcription_id == transcription_id)
        .order_by(AIResult.created_at.desc())
    )
    return result.scalars().all()
