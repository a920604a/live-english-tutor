# Live English Tutor

以即時語音為核心的 AI 英文家教系統。學生透過麥克風（與選配攝影機 / 螢幕分享）與 AI 老師（Emma）進行對話練習，系統即時糾錯、生成課後中文報告。

---

## 系統架構

```
瀏覽器（React + Vite）
    │  Google Sign-In (Firebase Auth)
    │  REST API (axios, 透過 Vite proxy)
    │  WebRTC 語音 + 視訊 (LiveKit JS SDK)
    ▼
FastAPI 後端  ──── PostgreSQL（Docker）
    │              用戶 / 課程 / 訊息 / 糾錯紀錄
    │  內部 HTTP (x-internal-secret)
    ▼
LiveKit Agent Worker（Emma）
    └── Google Gemini 2.5 Flash Native Audio
        （VAD + STT + LLM + TTS 一體，原生音訊模型）
        （video_enabled=True，可接收攝影機 / 螢幕分享）

外部服務
    ├── LiveKit（Self-hosted Docker）— 即時語音 / 視訊 WebRTC
    ├── Firebase             — 使用者認證（Google Sign-In）
    ├── Google Gemini API    — AI 老師對話 + 語音
    └── Ollama（外部伺服器） — 課後報告生成
```

---

## 前置條件

| 服務 | 用途 | 取得方式 |
|------|------|---------|
| [Firebase](https://console.firebase.google.com) | 使用者認證（Google Sign-In）+ Service Account | 建立專案 → Authentication → 啟用 Google |
| [Google AI Studio](https://aistudio.google.com) | Gemini API（AI 老師） | 取得 API Key |
| Ollama 伺服器 | 課後報告生成 | 預設使用 `192.168.15.235:11434`，需自行架設或修改 `OLLAMA_BASE_URL` |

> LiveKit 使用 **Self-hosted** 模式（Docker），不需要 LiveKit Cloud 帳號。

---

## 本地開發

### 1. 取得程式碼

```bash
git clone <your-repo-url>
cd live-english-tutor
```

### 2. 設定後端環境變數

```bash
cp .env.example .env
```

開啟 `.env` 填入必要欄位：

```dotenv
# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
FIREBASE_PROJECT_ID=your-project-id

# Google Gemini（AI 老師）
GOOGLE_API_KEY=AIzaSy...

# Ollama（報告生成）
OLLAMA_BASE_URL=http://your-ollama-server:11434/v1
OLLAMA_MODEL=gemma4:e2b   # 或 qwen3.5:35b 等

# LiveKit Self-hosted
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=your-secret-at-least-32-chars
LIVEKIT_NODE_IP=192.168.15.116   # 主機 LAN IP（區網其他裝置連線時填入）
```

### 3. 設定前端環境變數

```bash
cp frontend-web/.env.example frontend-web/.env.local
```

填入 Firebase Web SDK 設定：

```dotenv
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

> **Vite proxy 設定**（`vite.config.ts`）會自動將 `/auth/*`、`/sessions/*` 轉發到 `BACKEND_PROXY_URL`（預設 `http://localhost:8118`），`/rtc` 轉發到 LiveKit（預設 `http://localhost:7880`）。本地開發通常不需額外設定。

### 4. 啟動後端、Agent、LiveKit

```bash
# 啟動 PostgreSQL + Backend + Agent
make up

# 啟動 Self-hosted LiveKit Server（需先等 make up 完成）
make livekit-up

# 確認狀態
make ps
```

首次啟動時 FastAPI 會自動建立資料表，無需手動 migrate。

查看 log：
```bash
make logs-backend   # 後端 log
make logs-agent     # agent log
make livekit-logs   # LiveKit server log
```

### 5. 啟動前端

```bash
make fe-install   # 首次需安裝套件
make fe-dev       # 啟動 Vite dev server（port 5173）
```

開啟瀏覽器：**`http://localhost:5173`**（同機）或 **`http://<主機IP>:5173`**（區網其他裝置）

### 6. Firebase Authorized Domains

首次本地開發需到 Firebase Console → Authentication → Settings → Authorized domains，確認 `localhost` 已在清單中（預設已加入）。

---

## 常用指令（Makefile）

| 指令 | 說明 |
|------|------|
| `make up` | 啟動 postgres + backend + agent |
| `make livekit-up` | 啟動 LiveKit server |
| `make down` | 停止所有服務 |
| `make livekit-down` | 停止 LiveKit server |
| `make rebuild` | 重新建置 image 並啟動 |
| `make ps` | 顯示服務狀態 |
| `make logs` | 追蹤所有 log |
| `make fe-dev` | 啟動前端開發伺服器 |
| `make db-shell` | 進入 PostgreSQL 互動介面 |

---

## 生產部署

### 後端 + Agent

```bash
docker build -t your-registry/live-english-tutor-backend ./backend-fastapi
docker build -t your-registry/live-english-tutor-agent ./livekit-agent
```

在伺服器設定所有環境變數並執行。用 Nginx / Cloudflare Tunnel 設定反向代理。

### 前端（Cloudflare Pages）

1. 登入 Cloudflare Dashboard → Pages → Create a project
2. 連接 GitHub repo，Build settings：
   - **Framework**：Vite
   - **Build command**：`npm run build`
   - **Build output**：`dist`
   - **Root directory**：`frontend-web`
3. 在 Environment variables 填入所有 `VITE_*` 變數

部署後必做：
- Firebase Console → Authorized domains → 加入 `xxx.pages.dev`
- 後端 `app/main.py` 的 `ALLOWED_ORIGINS` 加入 Cloudflare Pages 網域

---

## 環境變數說明

### 根目錄 `.env`（後端 + Agent 共用）

| 變數 | 必填 | 預設值 | 說明 |
|------|:----:|--------|------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ✅* | — | Service Account JSON 壓縮成單行字串 |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | ✅* | — | Service Account JSON 本機路徑（與上方擇一） |
| `FIREBASE_PROJECT_ID` | ✅ | — | Firebase 專案 ID |
| `GOOGLE_API_KEY` | ✅ | — | Google Gemini API Key（AI 老師） |
| `DATABASE_URL` | — | `postgresql+psycopg2://tutor:tutor@postgres:5432/tutordb` | PostgreSQL 連線字串 |
| `POSTGRES_USER` | — | `tutor` | PostgreSQL 使用者 |
| `POSTGRES_PASSWORD` | — | `tutor` | PostgreSQL 密碼 |
| `POSTGRES_DB` | — | `tutordb` | PostgreSQL 資料庫名稱 |
| `INTERNAL_SECRET` | — | `internal-agent-secret` | Agent→Backend 內部通訊密鑰（建議修改） |
| `OLLAMA_BASE_URL` | — | `http://192.168.15.235:11434/v1` | Ollama API 位址 |
| `OLLAMA_MODEL` | — | `gemma4:e2b` | Ollama 模型名稱 |
| `LIVEKIT_URL` | — | `ws://livekit:7880` | Agent 連線 LiveKit（Docker 內部） |
| `LIVEKIT_PUBLIC_URL` | — | `ws://localhost:7880` | Backend 回傳給前端的 LiveKit URL |
| `LIVEKIT_API_KEY` | ✅ | — | LiveKit API Key（Self-hosted 可任意設定） |
| `LIVEKIT_API_SECRET` | ✅ | — | LiveKit API Secret（建議 ≥ 32 字元） |
| `LIVEKIT_NODE_IP` | — | `127.0.0.1` | ICE candidate 廣播 IP（區網存取時改為主機 LAN IP） |
| `ENABLE_REPORT_GENERATION` | — | `false` | 是否啟用課後報告生成 |

### 前端 `frontend-web/.env.local`

| 變數 | 必填 | 說明 |
|------|:----:|------|
| `VITE_FIREBASE_API_KEY` | ✅ | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | Firebase 專案 ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | ✅ | Firebase App ID |
| `BACKEND_PROXY_URL` | — | Vite proxy 轉發目標（預設 `http://localhost:8118`） |
| `LIVEKIT_PROXY_URL` | — | Vite proxy 轉發目標（預設 `http://localhost:7880`） |
| `VITE_API_BASE_URL` | — | 後端公開 URL（生產環境 Cloudflare Pages 填入） |
| `VITE_LIVEKIT_URL` | — | LiveKit Cloud URL（生產環境填入，dev 不需要） |

---

## API 端點速查

### Protected（需 Firebase ID Token）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `POST` | `/auth/verify` | Firebase token 驗證，建立/取得使用者 |
| `POST` | `/sessions/` | 建立新課程 |
| `GET` | `/sessions/` | 列出我的所有課程 |
| `GET` | `/sessions/{id}` | 取得單一課程資訊 |
| `POST` | `/sessions/{id}/token` | 取得 LiveKit token（同時建立 Room + dispatch Agent） |
| `POST` | `/sessions/{id}/end` | 結束課程 |
| `GET` | `/sessions/{id}/report` | 查詢課後報告（`status: disabled/pending/ready`） |
| `GET` | `/sessions/{id}/messages` | 取得對話紀錄 |

### Internal（需 `x-internal-secret` header，僅 Agent 使用）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `POST` | `/internal/agent/message` | 持久化對話訊息 |
| `POST` | `/internal/agent/correction` | 持久化語法糾錯 |
| `POST` | `/internal/agent/session-ended` | 通知課程結束 |

---

## 目錄結構

```
live-english-tutor/
├── backend-fastapi/
│   └── app/
│       ├── api/              # 路由（auth, sessions, messages, agent_callbacks）
│       ├── models/           # SQLAlchemy ORM 模型
│       ├── schemas/          # Pydantic Schema
│       ├── services/         # livekit_service, report_service
│       ├── config.py
│       ├── database.py
│       ├── firebase_app.py
│       └── main.py
├── livekit-agent/
│   └── agent/
│       ├── main.py           # Worker 入口
│       ├── tutor_agent.py    # TutorAgent + function tools
│       ├── state_machine.py  # WARMUP → PRACTICE → CORRECTION → SUMMARY
│       ├── prompts.py        # 各階段 System Prompt
│       └── backend_client.py
├── frontend-web/
│   └── src/
│       ├── components/lesson/ # ToolBar / VideoGrid / CaptionPanel /
│       │                      # AgentStatus / VoiceControls / CorrectionPanel
│       ├── pages/             # LoginPage / DashboardPage / LessonPage / ReportPage
│       ├── api/               # sessions.ts, auth.ts, client.ts
│       ├── hooks/             # useAgentData.ts
│       ├── store/             # authStore.ts
│       └── router.tsx
├── docs/
│   ├── PRD.md
│   ├── FRD.md
│   ├── architecture.md
│   └── superpowers/specs/
├── docker-compose.yml         # postgres + backend + agent
├── docker-compose.livekit.yml # Self-hosted LiveKit server
├── Makefile
└── .env.example
```

---

## 技術堆疊

| 層次 | 技術 |
|------|------|
| **前端** | React 18, TypeScript, Vite, React Router v6, Zustand, Axios, LiveKit JS SDK |
| **後端** | FastAPI, SQLAlchemy 2.0, PostgreSQL 16, Firebase Admin SDK, LiveKit API SDK |
| **AI Agent** | LiveKit Agents SDK 1.x, Google Gemini 2.5 Flash Native Audio（Realtime） |
| **報告生成** | Ollama（OpenAI 相容 API，外部伺服器） |
| **認證** | Firebase Authentication（Google Sign-In） |
| **即時語音/視訊** | LiveKit Self-hosted（WebRTC） |
| **部署** | Docker Compose（後端）、Cloudflare Pages（前端） |

---

## 常見問題

**Q：Agent 沒有加入 room？**  
確認 `LIVEKIT_API_KEY`、`LIVEKIT_API_SECRET` 正確，LiveKit server 正常運行（`make livekit-logs`），以及 agent 服務正常（`make logs-agent`）。

**Q：WebRTC 連線失敗（`could not establish pc connection`）？**  
從區網其他裝置存取時，需設定 `LIVEKIT_NODE_IP=<主機LAN IP>`（例如 `192.168.15.116`），讓 ICE candidates 廣播正確的 IP。設定後執行 `make livekit-down && make livekit-up`。

**Q：Google Sign-In 出現 `auth/unauthorized-domain` 錯誤？**  
Firebase Console → Authentication → Settings → Authorized domains，加入目前使用的網域。

**Q：報告一直顯示「生成中」？**  
確認 `.env` 的 `ENABLE_REPORT_GENERATION=true`，以及 `OLLAMA_BASE_URL` 伺服器可連線（`curl $OLLAMA_BASE_URL/models`）。

**Q：CORS 錯誤？**  
確認後端 `app/main.py` 的 `ALLOWED_ORIGINS` 已加入前端網域，重新啟動 backend（`docker compose restart backend`）。
