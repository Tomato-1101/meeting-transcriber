"""ステートレス AI 処理エンドポイント。

POST /api/ai → クライアントから transcription 全文 + result_type + model + custom_prompt を受信、
              AI を呼んで結果テキストだけ返す（DB 書き込みなし）。
GET /api/ai-prompts → プロンプトテンプレート一覧（DB 不要）。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.ai_service import run_ai_processing, PROMPTS, PROMPT_META
from app.utils.logger import logger

router = APIRouter(tags=["ai_processing"])

ALLOWED_MODELS = {
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
}


class AIPromptInfo(BaseModel):
    type: str
    label: str
    description: str
    category: str
    prompt: str


class AIRequest(BaseModel):
    full_text: str = Field(min_length=1)
    result_type: str
    model: str = "gemini-2.5-flash"
    custom_prompt: str | None = None


class AIResponse(BaseModel):
    result_text: str
    prompt_used: str


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


@router.post("/ai", response_model=AIResponse)
async def run_ai(request: AIRequest):
    if request.model not in ALLOWED_MODELS:
        raise HTTPException(400, f"Unsupported model: {request.model}")

    allowed_types = set(PROMPTS.keys()) | {"custom"}
    if request.result_type not in allowed_types:
        raise HTTPException(400, f"Unsupported result type: {request.result_type}")

    if request.result_type == "custom" and not request.custom_prompt:
        raise HTTPException(400, "custom_prompt is required for custom result type")

    try:
        result_text = await run_ai_processing(
            full_text=request.full_text,
            result_type=request.result_type,
            model=request.model,
            custom_prompt=request.custom_prompt,
        )
    except Exception:
        # SDK 例外メッセージにキー断片が混入しうるのでクライアントには返さない。
        logger.exception("AI processing failed")
        raise HTTPException(502, "AI processing failed")

    prompt_used = request.custom_prompt or PROMPTS.get(request.result_type, "")
    return AIResponse(result_text=result_text, prompt_used=prompt_used)
