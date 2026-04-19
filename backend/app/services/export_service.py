import json

from app.models.transcription import Transcription


def export_as_text(transcription: Transcription) -> str:
    lines = [f"# Transcription: {transcription.job_id}", ""]

    if transcription.segments:
        for seg in transcription.segments:
            timestamp = _format_time(seg.start_time)
            speaker = f"[{seg.speaker}] " if seg.speaker else ""
            lines.append(f"[{timestamp}] {speaker}{seg.text}")
    else:
        lines.append(transcription.full_text)

    return "\n".join(lines)


def export_as_json(transcription: Transcription) -> dict:
    return {
        "id": transcription.id,
        "job_id": transcription.job_id,
        "full_text": transcription.full_text,
        "model_used": transcription.model_used,
        "language_detected": transcription.language_detected,
        "duration_seconds": transcription.duration_seconds,
        "segments": [
            {
                "speaker": seg.speaker,
                "text": seg.text,
                "start_time": seg.start_time,
                "end_time": seg.end_time,
            }
            for seg in transcription.segments
        ],
    }


def _format_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"
