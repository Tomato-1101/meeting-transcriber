# ---------- Stage 1: Build frontend ----------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Backend runtime ----------
FROM python:3.12-slim AS runtime

# ffmpeg は pydub の音声変換で必要
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FRONTEND_DIST=/app/frontend/dist \
    TORCH_HOME=/app/.cache/torch

COPY backend/requirements.txt /app/backend/requirements.txt

# CPU 専用 torch / torchaudio を先にインストール（イメージサイズと CUDA 依存を避ける）
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchaudio \
    && pip install --no-cache-dir -r /app/backend/requirements.txt

# silero-vad モデルをビルド時に取得しておき、初回ジョブの遅延と Railway 起動時 DL を回避
RUN mkdir -p $TORCH_HOME && python -c "import torch; torch.hub.load('snakers4/silero-vad', 'silero_vad', trust_repo=True)" || echo "silero-vad pre-download failed; will retry at runtime"

COPY backend/app /app/backend/app

# Stage 1 でビルドした静的ファイル
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Railway が $PORT を注入するのでそれに追従（無ければ 8000）
ENV PORT=8000
EXPOSE 8000

WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
