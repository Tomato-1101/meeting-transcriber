from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.transcription import Transcription
from app.models.ai_result import AIResult
from app.schemas.ai_result import (
    AIProcessRequest,
    AIResultResponse,
    AIPromptInfo,
)
from app.services.ai_service import run_ai_processing, PROMPTS, PROMPT_META
from app.utils.logger import logger

router = APIRouter(tags=["ai_processing"])

ALLOWED_MODELS = {
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
}


@router.get("/ai-prompts", response_model=list[AIPromptInfo])
async def list_ai_prompts():
    """全プロンプトテンプレートのメタ情報と本文を返す。フロント側でプレビュー表示に使用。"""
    items: list[AIPromptInfo] = []
    for key, prompt in PROMPTS.items():
        meta = PROMPT_META.get(key, {})
        items.append(
            AIPromptInfo(
                type=key,
                label=meta.get("label", key),
                description=meta.get("description", ""),
                category=meta.get("category", "general"),
                prompt=prompt,
            )
        )
    return items


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

    if request.model not in ALLOWED_MODELS:
        raise HTTPException(400, f"Unsupported model: {request.model}")

    allowed_types = set(PROMPTS.keys()) | {"custom"}
    if request.result_type not in allowed_types:
        raise HTTPException(400, f"Unsupported result type: {request.result_type}")

    if request.result_type == "custom" and not request.custom_prompt:
        raise HTTPException(400, "custom_prompt is required for custom result type")

    try:
        result_text = await run_ai_processing(
            full_text=transcription.full_text,
            result_type=request.result_type,
            model=request.model,
            custom_prompt=request.custom_prompt,
        )
    except Exception:
        # SDK 例外メッセージにキー断片が混入しうるのでクライアントには返さない。
        logger.exception("AI processing failed")
        raise HTTPException(502, "AI processing failed")

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


@router.delete("/ai-results/{ai_result_id}")
async def delete_ai_result(
    ai_result_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AIResult).where(AIResult.id == ai_result_id))
    ai_result = result.scalar_one_or_none()
    if not ai_result:
        raise HTTPException(404, "AI result not found")
    await db.delete(ai_result)
    await db.commit()
    return {"status": "deleted"}
