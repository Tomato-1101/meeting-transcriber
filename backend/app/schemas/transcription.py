from datetime import datetime
from pydantic import BaseModel


class SegmentResponse(BaseModel):
    id: str
    speaker: str | None
    text: str
    start_time: float
    end_time: float
    sequence_order: int

    model_config = {"from_attributes": True}


class TranscriptionResponse(BaseModel):
    id: str
    job_id: str
    full_text: str
    model_used: str
    language_detected: str | None
    duration_seconds: float
    created_at: datetime
    segments: list[SegmentResponse] = []

    model_config = {"from_attributes": True}
