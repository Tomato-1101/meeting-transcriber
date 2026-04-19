import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AIResult(Base):
    __tablename__ = "ai_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transcription_id: Mapped[str] = mapped_column(String(36), ForeignKey("transcriptions.id", ondelete="CASCADE"))
    result_type: Mapped[str] = mapped_column(String(30))
    prompt_used: Mapped[str] = mapped_column(Text)
    model_used: Mapped[str] = mapped_column(String(50))
    result_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    transcription: Mapped["Transcription"] = relationship(back_populates="ai_results")
