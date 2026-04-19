import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
CHUNKS_DIR = DATA_DIR / "chunks"
DATABASE_URL = f"sqlite+aiosqlite:///{DATA_DIR / 'db.sqlite3'}"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
CHUNKS_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_SIZE_MB = 500
CHUNK_TARGET_DURATION_MS = 900_000  # 15 minutes
CHUNK_MAX_FILE_SIZE_MB = 20
CHUNK_MAX_DURATION_S = 1200  # 20 minutes

SUPPORTED_AUDIO_FORMATS = {
    ".mp3", ".wav", ".m4a", ".mp4", ".webm", ".mpeg", ".mpga", ".ogg", ".flac",
}
