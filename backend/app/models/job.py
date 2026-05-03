import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Float, Integer, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    original_filename: Mapped[str] = mapped_column(String(255))
    original_file_path: Mapped[str] = mapped_column(Text)
    file_size_bytes: Mapped[int] = mapped_column(Integer)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    model: Mapped[str] = mapped_column(String(50))
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    num_chunks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    preprocess_profile: Mapped[str] = mapped_column(String(20), default="standard")
    preprocess_stats: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    transcription: Mapped["Transcription | None"] = relationship(back_populates="job", uselist=False)
