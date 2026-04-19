import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Float, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Transcription(Base):
    __tablename__ = "transcriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"))
    full_text: Mapped[str] = mapped_column(Text)
    model_used: Mapped[str] = mapped_column(String(50))
    language_detected: Mapped[str | None] = mapped_column(String(10), nullable=True)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    job: Mapped["Job"] = relationship(back_populates="transcription")
    segments: Mapped[list["Segment"]] = relationship(back_populates="transcription", order_by="Segment.sequence_order")
    ai_results: Mapped[list["AIResult"]] = relationship(back_populates="transcription")


class Segment(Base):
    __tablename__ = "segments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transcription_id: Mapped[str] = mapped_column(String(36), ForeignKey("transcriptions.id", ondelete="CASCADE"))
    speaker: Mapped[str | None] = mapped_column(String(50), nullable=True)
    text: Mapped[str] = mapped_column(Text)
    start_time: Mapped[float] = mapped_column(Float)
    end_time: Mapped[float] = mapped_column(Float)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    sequence_order: Mapped[int] = mapped_column(Integer)

    transcription: Mapped["Transcription"] = relationship(back_populates="segments")
