import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles

from app.auth import (
    COOKIE_NAME,
    COOKIE_TTL_SEC,
    issue_session,
    verify_handoff,
    verify_session,
)
from app.database import init_db
from app.routers import jobs, transcriptions, ai_processing, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Meeting Transcription API", version="1.0.0", lifespan=lifespan)

_cors_env = os.getenv("CORS_ORIGINS", "http://localhost:5173")
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
# `*` + allow_credentials は cookie が送れない（ブラウザが弾く）+ 設定ミスを誘発するので
# 起動時に拒否する。明示的なオリジンだけを受け付ける。
if "*" in _cors_origins:
    raise RuntimeError("CORS_ORIGINS=* with credentials is not allowed; set explicit origins")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 認証ゲート: ポータル経由のハンドオフ or 既存セッション cookie のみ通す。
# /_enter, /api/health, /favicon.ico は無認証で通す。HMAC_SECRET が未設定なら認証を無効化（ローカル開発時）。
_AUTH_ENABLED = bool(os.environ.get("HMAC_SECRET"))
_ALLOW_PATHS = {"/_enter", "/api/health", "/favicon.ico"}


@app.middleware("http")
async def auth_gate(request: Request, call_next):
    if not _AUTH_ENABLED:
        return await call_next(request)
    path = request.url.path
    if path in _ALLOW_PATHS:
        return await call_next(request)
    if verify_session(request.cookies.get(COOKIE_NAME)):
        return await call_next(request)
    return JSONResponse({"detail": "unauthorized"}, status_code=401)


@app.get("/_enter", include_in_schema=False)
async def enter(t: str | None = None, s: str | None = None):
    if not _AUTH_ENABLED:
        return RedirectResponse("/", status_code=302)
    if not t or not s or not verify_handoff(t, s, expected_tool="meeting-transcriber"):
        return JSONResponse({"detail": "invalid or expired handoff token"}, status_code=403)
    resp = RedirectResponse("/", status_code=302)
    resp.set_cookie(
        key=COOKIE_NAME,
        value=issue_session(),
        max_age=COOKIE_TTL_SEC,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return resp


app.include_router(jobs.router, prefix="/api")
app.include_router(transcriptions.router, prefix="/api")
app.include_router(ai_processing.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# 本番ビルド時のみ frontend/dist を同一オリジンで配信する。
# Dockerfile で dist を /app/frontend/dist に配置する想定。
_FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", "/app/frontend/dist"))
if _FRONTEND_DIST.is_dir():
    _INDEX = _FRONTEND_DIST / "index.html"
    app.mount(
        "/assets",
        StaticFiles(directory=_FRONTEND_DIST / "assets"),
        name="assets",
    )

    _DIST_RESOLVED = _FRONTEND_DIST.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        # /api は上のルータが捕まえているのでここには来ないが、念のためガード
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        # path traversal 防止: resolve した結果が dist 配下に収まることを必ず確認
        candidate = (_FRONTEND_DIST / full_path).resolve()
        try:
            candidate.relative_to(_DIST_RESOLVED)
        except ValueError:
            return FileResponse(_INDEX)
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_INDEX)
