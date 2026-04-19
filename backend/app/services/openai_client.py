import asyncio
from pathlib import Path

from openai import AsyncOpenAI

from app.config import OPENAI_API_KEY
from app.utils.logger import logger

client = AsyncOpenAI(api_key=OPENAI_API_KEY)


async def transcribe_audio(
    file_path: Path,
    model: str = "gpt-4o-mini-transcribe",
    language: str | None = None,
) -> dict:
    logger.info(f"Transcribing {file_path.name} with {model}")

    is_diarize = "diarize" in model

    with open(file_path, "rb") as audio_file:
        kwargs: dict = {
            "model": model,
            "file": audio_file,
        }

        if language:
            kwargs["language"] = language

        if is_diarize:
            kwargs["response_format"] = "diarized_json"
        else:
            kwargs["response_format"] = "json"

        for attempt in range(3):
            try:
                response = await client.audio.transcriptions.create(**kwargs)
                break
            except Exception as e:
                if attempt < 2:
                    wait = 2 ** (attempt + 1)
                    logger.warning(f"Transcription attempt {attempt+1} failed, retrying in {wait}s: {e}")
                    await asyncio.sleep(wait)
                else:
                    raise

    if is_diarize:
        return _parse_diarized_response(response)
    else:
        return _parse_simple_response(response)


def _parse_diarized_response(response) -> dict:
    result = {
        "text": "",
        "segments": [],
        "language": getattr(response, "language", None),
    }

    raw = response
    if hasattr(raw, "model_dump"):
        raw = raw.model_dump()

    if isinstance(raw, dict):
        result["text"] = raw.get("text", "")
        for i, seg in enumerate(raw.get("segments", [])):
            result["segments"].append({
                "speaker": seg.get("speaker", None),
                "text": seg.get("text", ""),
                "start_time": seg.get("start", 0.0),
                "end_time": seg.get("end", 0.0),
                "sequence_order": i,
            })
        result["language"] = raw.get("language", None)
    else:
        result["text"] = str(raw)

    return result


def _parse_simple_response(response) -> dict:
    raw = response
    if hasattr(raw, "model_dump"):
        raw = raw.model_dump()

    text = raw.get("text", str(raw)) if isinstance(raw, dict) else str(raw)

    return {
        "text": text,
        "segments": [],
        "language": raw.get("language", None) if isinstance(raw, dict) else None,
    }
