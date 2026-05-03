# meeting-transcriber

会議の音声ファイル / Web ストリームから文字起こし → 話者分離 → 要約・議事録化までを
ワンストップでこなす Web アプリ。フロントエンド（React + Vite）とバックエンド（FastAPI）の
モノレポ構成で、Docker 1 コンテナで起動できる。

[myprojects-portal](https://myprojects-portal.vercel.app) からパスワード認証付きで利用する想定。

---

## 目次

- [構成](#構成)
- [ローカル開発](#ローカル開発)
- [認証フロー](#認証フロー)
- [Render へのデプロイ](#render-へのデプロイ)
- [環境変数](#環境変数)
- [セキュリティ](#セキュリティ)
- [既知のメモリ事情](#既知のメモリ事情)

---

## 構成

```
meeting-transcriber/
├── backend/                 # FastAPI + faster-whisper + torch
│   ├── app/
│   │   ├── main.py          # FastAPI app, 認証 middleware, /_enter
│   │   ├── auth.py          # HMAC handoff/session 検証
│   │   ├── database.py
│   │   └── routers/         # jobs / transcriptions / ai_processing / chat
│   └── requirements.txt
├── frontend/                # React (Vite) SPA
│   └── src/
└── Dockerfile               # multi-stage: frontend build → backend に dist を同梱
```

Dockerfile の最終ステージで `frontend/dist` を `/app/frontend/dist` に置き、
`backend/app/main.py` の SPA fallback がそれを配信する。
**フロントとバックエンドは同一オリジン**（`/api/*` は backend、それ以外は SPA）なので CORS は不要。

---

## ローカル開発

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend (別ターミナル)
cd frontend
npm install
npm run dev   # http://localhost:5173, /api proxy で 8000 を呼ぶ
```

`HMAC_SECRET` を設定しなければ認証ミドルウェアは自動的にバイパスされる。
ポータル → Render 経由のフローを試したい場合のみ、ポータルと同じ値を `.env` に置く。

---

## 認証フロー

ポータルから `/_enter?t=...&s=...` にリダイレクトされると、`backend/app/auth.py` が
HMAC 署名 + `expected_tool="meeting-transcriber"` + 期限を検証し、
24 時間の `meeting_session` cookie を発行する。

```
[ユーザー] ─ password 入力 ──► [Vercel Server Action]
                                 │ HMAC_SECRET で 5 分有効の handoff token を発行
                                 │   t = base64url("meeting-transcriber.<exp_ms>")
                                 │   s = base64url(HMAC_SHA256(secret, t))
                                 ▼
[ブラウザ] ─────────────────► [Render /_enter?t=...&s=...]
                                 │ ① HMAC 署名検証
                                 │ ② tool == "meeting-transcriber" を確認
                                 │ ③ 期限内かを確認
                                 │ ④ 24h cookie (meeting_session) を発行
                                 ▼ 302 redirect: /
[Render が cookie を見ながらアプリを返す。401 if cookie 無効]
```

| パス | 認証要否 |
|---|---|
| `/_enter` | 不要（ポータルからの handoff 受け口） |
| `/api/health` | 不要 |
| `/favicon.ico` | 不要 |
| それ以外（API + SPA fallback） | **要** |

session cookie は `HttpOnly` + `Secure` + `SameSite=Lax`、24h 有効、HMAC 署名付き。
`expected_tool="meeting-transcriber"` を Render 側で照合するので、keyprobe など別ツール用の
token が紛れ込んでも通らない（cross-tool 流用防止）。

---

## Render へのデプロイ

1. Render Dashboard → New Web Service → GitHub の `Tomato-1101/meeting-transcriber` を選択
2. Environment: **Docker** を選択（リポジトリ直下の `Dockerfile` が自動検出される）
3. 環境変数:
   - `HMAC_SECRET`: ポータルと **同一の値**（`openssl rand -base64 32` で生成）
   - `OPENAI_API_KEY`: tomato の OpenAI キー
   - `GOOGLE_API_KEY`: tomato の Google AI キー
   - `CORS_ORIGINS=https://myprojects-portal.vercel.app`（同一オリジン配信なので保険）
4. デプロイ完了後の URL を Vercel 側の `MEETING_TRANSCRIBER_URL` に登録し、ポータルを再デプロイする

---

## 環境変数

| 変数 | 用途 | 設定先 |
|---|---|---|
| `HMAC_SECRET` | handoff/session 署名検証 | Render |
| `OPENAI_API_KEY` | Whisper API / GPT による要約 | Render |
| `GOOGLE_API_KEY` | Gemini による要約・チャット | Render |
| `CORS_ORIGINS` | 同一オリジン配信なので通常不要 | Render（任意） |
| `FRONTEND_DIST` | SPA dist のパス（Docker 内 `/app/frontend/dist`） | Docker 固定 |

---

## セキュリティ

- ポータル → Render は HMAC 署名付き handoff token（5 分有効）でつなぐ。
- 24h セッション cookie は `HttpOnly` + `Secure` + `SameSite=Lax`、HMAC 署名付き。
- 第三者が直接 Render URL を叩いても 401。tomato 専用ロック。
- 音声ファイル・文字起こしテキストは Render の ephemeral fs に一時保存され、再起動で消える。
- OpenAI / Google のキーは Render の環境変数のみ。コードや GitHub には絶対に出さない。

---

## 既知のメモリ事情

Render Free プランは 512MB / 750h・月 / 15 分アイドルでスリープ。
torch + noisereduce + silero-vad で **480MB ギリギリ** に収まる想定。

メモリ落ちが頻発した場合の打ち手：

- **lazy import**: 推論時にだけ `import torch` する（初回リクエストが少し遅くなる）
- **noisereduce を外す**: VAD だけで十分なケースが多い
- **Starter にアップグレード**: $7/月 で 1GB に上がる
