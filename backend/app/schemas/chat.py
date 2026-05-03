from datetime import datetime
from pydantic import BaseModel, Field


class ChatMessageResponse(BaseModel):
    id: str
    ai_result_id: str
    role: str
    content: str
    model_used: str | None
    created_at: datetime
    sequence_order: int

    model_config = {"from_attributes": True}


class ChatSendRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    model: str = "gemini-2.5-flash"


class ChatSendResponse(BaseModel):
    user: ChatMessageResponse
    assistant: ChatMessageResponse
