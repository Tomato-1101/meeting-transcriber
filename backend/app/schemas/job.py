from datetime import datetime
from pydantic import BaseModel


class JobCreate(BaseModel):
    model: str = "gpt-4o-transcribe-diarize"
    language: str | None = None


class JobResponse(BaseModel):
    id: str
    status: str
    original_filename: str
    file_size_bytes: int
    duration_seconds: float | None
    model: str
    language: str | None
    num_chunks: int | None
    progress: float
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    transcription_id: str | None = None

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    jobs: list[JobResponse]
    total: int
