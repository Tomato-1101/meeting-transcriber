from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.ai_result import AIResult
from app.models.chat import ChatMessage
from app.models.transcription import Transcription
from app.schemas.chat import ChatMessageResponse, ChatSendRequest, ChatSendResponse
from app.services.ai_service import run_chat
from app.utils.logger import logger

router = APIRouter(tags=["chat"])

ALLOWED_MODELS = {
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
}


@router.get("/ai-results/{ai_result_id}/chat", response_model=list[ChatMessageResponse])
async def list_chat_messages(
    ai_result_id: str,
    db: AsyncSession = Depends(get_db),
):
    exists = await db.execute(select(AIResult.id).where(AIResult.id == ai_result_id))
    if not exists.scalar_one_or_none():
        raise HTTPException(404, "AI result not found")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.ai_result_id == ai_result_id)
        .order_by(ChatMessage.sequence_order.asc())
    )
    return result.scalars().all()


@router.post("/ai-results/{ai_result_id}/chat", response_model=ChatSendResponse)
async def send_chat_message(
    ai_result_id: str,
    request: ChatSendRequest,
    db: AsyncSession = Depends(get_db),
):
    if request.model not in ALLOWED_MODELS:
        raise HTTPException(400, f"Unsupported model: {request.model}")

    ai_result_q = await db.execute(
        select(AIResult)
        .where(AIResult.id == ai_result_id)
        .options(selectinload(AIResult.chat_messages))
    )
    ai_result = ai_result_q.scalar_one_or_none()
    if not ai_result:
        raise HTTPException(404, "AI result not found")

    transcription_q = await db.execute(
        select(Transcription).where(Transcription.id == ai_result.transcription_id)
    )
    transcription = transcription_q.scalar_one_or_none()
    if not transcription:
        raise HTTPException(404, "Transcription not found")

    history = [
        {"role": m.role, "content": m.content}
        for m in sorted(ai_result.chat_messages, key=lambda m: m.sequence_order)
    ]
    next_seq = (
        max((m.sequence_order for m in ai_result.chat_messages), default=-1) + 1
    )

    user_msg = ChatMessage(
        ai_result_id=ai_result_id,
        role="user",
        content=request.content,
        model_used=None,
        sequence_order=next_seq,
    )
    db.add(user_msg)
    await db.flush()

    try:
        assistant_text = await run_chat(
            transcription_text=transcription.full_text,
            ai_result_text=ai_result.result_text,
            ai_result_type=ai_result.result_type,
            history=history,
            user_message=request.content,
            model=request.model,
        )
    except Exception:
        # SDK 例外メッセージにキー断片や URL が混入する可能性があるのでクライアントには返さない。
        logger.exception("Chat call failed")
        await db.rollback()
        raise HTTPException(500, "Chat failed")

    assistant_msg = ChatMessage(
        ai_result_id=ai_result_id,
        role="assistant",
        content=assistant_text,
        model_used=request.model,
        sequence_order=next_seq + 1,
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    return ChatSendResponse(user=user_msg, assistant=assistant_msg)
