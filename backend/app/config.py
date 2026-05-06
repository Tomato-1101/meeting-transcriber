import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

# 制限値・モデル設定
MAX_UPLOAD_SIZE_MB = 500
CHUNK_TARGET_DURATION_MS = 900_000  # 15 minutes
CHUNK_MAX_FILE_SIZE_MB = 20
CHUNK_MAX_DURATION_S = 1200  # 20 minutes

SUPPORTED_AUDIO_FORMATS = {
    ".mp3", ".wav", ".m4a", ".mp4", ".webm", ".mpeg", ".mpga", ".ogg", ".flac",
}

# サーバ側ステートレス化に伴い、永続的な UPLOADS_DIR / CHUNKS_DIR / DATABASE_URL は撤廃。
# 各リクエストの作業ディレクトリは tempfile で都度作る。
# 環境変数 TEMP_BASE で tempdir のベースを指定可能（未指定なら OS デフォルト）。
_TEMP_BASE_ENV = os.getenv("TEMP_BASE")
TEMP_BASE: Path | None = Path(_TEMP_BASE_ENV) if _TEMP_BASE_ENV else None
if TEMP_BASE is not None:
    TEMP_BASE.mkdir(parents=True, exist_ok=True)
