"""ステートレスチャットエンドポイント。

クライアントが transcription 全文 + ai_result 全文 + これまでの history を毎回送ってくる前提。
サーバは LLM を呼んでアシスタント応答を返すだけ。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.ai_service import run_chat
from app.utils.logger import logger

router = APIRouter(tags=["chat"])

ALLOWED_MODELS = {
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
}

ALLOWED_ROLES = {"user", "assistant"}


class ChatHistoryEntry(BaseModel):
    role: str
    content: str

    @field_validator("role")
    @classmethod
    def role_in_allowed(cls, v: str) -> str:
        if v not in ALLOWED_ROLES:
            raise ValueError(f"role must be one of {ALLOWED_ROLES}")
        return v


class ChatRequest(BaseModel):
    transcription_text: str = Field(min_length=1)
    ai_result_text: str = Field(min_length=1)
    ai_result_type: str
    history: list[ChatHistoryEntry] = Field(default_factory=list)
    user_message: str = Field(min_length=1, max_length=8000)
    model: str = "gemini-2.5-flash"


class ChatResponse(BaseModel):
    content: str


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if request.model not in ALLOWED_MODELS:
        raise HTTPException(400, f"Unsupported model: {request.model}")

    try:
        text = await run_chat(
            transcription_text=request.transcription_text,
            ai_result_text=request.ai_result_text,
            ai_result_type=request.ai_result_type,
            history=[h.model_dump() for h in request.history],
            user_message=request.user_message,
            model=request.model,
        )
    except Exception:
        # SDK 例外メッセージにキー断片や URL が混入しうるのでクライアントには返さない。
        logger.exception("Chat failed")
        raise HTTPException(502, "Chat failed")

    return ChatResponse(content=text)
