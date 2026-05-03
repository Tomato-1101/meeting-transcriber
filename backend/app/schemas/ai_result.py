from datetime import datetime
from pydantic import BaseModel


class AIProcessRequest(BaseModel):
    result_type: str
    model: str = "gemini-2.5-flash"
    custom_prompt: str | None = None


class AIResultResponse(BaseModel):
    id: str
    transcription_id: str
    result_type: str
    model_used: str
    result_text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AIPromptInfo(BaseModel):
    type: str
    label: str
    description: str
    category: str  # "lecture" | "meeting" | "general"
    prompt: str
