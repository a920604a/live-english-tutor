# Live English Tutor

以即時語音為核心的 AI 英文家教系統。學生透過麥克風與 AI 老師（Emma）進行真人感對話練習，系統即時糾正語法錯誤、生成課後中文報告。

---

## 系統架構

```
瀏覽器（React + Vite）
    │  Google Sign-In (Firebase Auth)
    │  REST API (axios)
    │  WebRTC 語音 (LiveKit JS SDK)
    ▼
FastAPI 後端  ──── PostgreSQL（Docker）
    │              用戶 / 課程 / 訊息 / 糾錯紀錄
    │  內部 HTTP
    ▼
LiveKit Agent Worker（Emma）
    ├── VAD：Silero（語音活動偵測）
    ├── STT：Deepgram nova-3（語音轉文字）
    ├── LLM：Ollama（外部伺服器 192.168.15.235）
    └── TTS：Cartesia Sonic（文字轉語音）

外部服務
    ├── LiveKit Cloud — 即時語音 WebRTC 基礎設施
    ├── Firebase     — 使用者認證（Google Sign-In）
    ├── Deepgram     — Speech-to-Text
    └── Cartesia     — Text-to-Speech
```

---

## 前置條件

在開始之前，請準備好以下帳號與 API Keys：

| 服務 | 用途 | 取得方式 |
|------|------|---------|
| [Firebase](https://console.firebase.google.com) | 使用者認證（Google Sign-In） + Service Account | 建立專案 → Authentication → 啟用 Google |
| [LiveKit Cloud](https://cloud.livekit.io) | 即時語音 WebRTC | 建立專案 → 取得 API Key/Secret/URL |
| [Deepgram](https://console.deepgram.com) | 語音轉文字（STT） | 免費方案即可 |
| [Cartesia](https://play.cartesia.ai) | 文字轉語音（TTS） | 免費方案即可 |
| Ollama 伺服器 | LLM 推理 | 預設使用 `192.168.15.235:11434`，需自行架設或修改 `OLLAMA_BASE_URL` |

---

## 本地開發

### 1. 取得程式碼

```bash
git clone <your-repo-url>
cd live-english-tutor
```

### 2. 設定環境變數

```bash
cp .env.example .env
```

開啟 `.env` 並填入以下必要欄位（詳細說明見[環境變數說明](#環境變數說明)）：

```dotenv
# Firebase（後端用）
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
FIREBASE_PROJECT_ID=your-project-id

# LiveKit Cloud
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxx

# STT / TTS
DEEPGRAM_API_KEY=xxx
CARTESIA_API_KEY=xxx
```

### 3. 設定前端環境變數

```bash
cp frontend-web/.env.example frontend-web/.env.local
```

填入 Firebase Web SDK 設定（從 Firebase Console → 專案設定 → 一般 → 您的應用程式取得）：

```dotenv
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

> **本地開發不需要設定 `VITE_API_BASE_URL`**：`vite.config.ts` 已設定 proxy，自動將 `/auth/*`、`/sessions/*`、`/internal/*` 請求轉發到 `http://localhost:8000`。

### 4. 啟動後端與 Agent

```bash
docker compose up -d postgres backend agent
```

首次啟動時 FastAPI 會自動建立資料表，無需手動 migrate。

確認服務狀態：
```bash
docker compose ps
docker compose logs -f backend   # 查看後端 log
docker compose logs -f agent     # 查看 agent log
```

### 5. 啟動前端

```bash
cd frontend-web
npm install
npm run dev
```

開啟瀏覽器：**http://localhost:5173**

### 6. Firebase Authorized Domains

首次本地開發需到 Firebase Console → Authentication → Settings → Authorized domains，確認 `localhost` 已在清單中（預設已加入）。

---

## Docker 全服務部署

若想在同一台機器上跑所有服務（不含前端，前端走 Cloudflare Pages）：

```bash
cp .env.example .env
# 填入 .env 所有必要值
docker compose up -d
```

服務對應：
- 後端 API：`http://localhost:8118`
- PostgreSQL：`localhost:5432`
- Agent：無對外 port，監聽 LiveKit Cloud 的 room 事件

---

## 生產部署

### 後端

1. 建置 Docker image 並推送到 registry：
   ```bash
   docker build -t your-registry/live-english-tutor-backend ./backend-fastapi
   docker push your-registry/live-english-tutor-backend
   ```
2. 在伺服器上執行（需設定所有環境變數）
3. 用 Nginx / Cloudflare Tunnel 設定反向代理，綁定 HTTPS 網域

### Agent

```bash
docker build -t your-registry/live-english-tutor-agent ./livekit-agent
docker push your-registry/live-english-tutor-agent
```

Agent 以 worker 形式運行，啟動後自動監聽 LiveKit Cloud 的新 room，無需對外開放 port。

### 前端（Cloudflare Pages）

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → Create a project
2. 連接 GitHub repo
3. Build settings：
   - **Framework preset**：Vite
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
   - **Root directory**：`frontend-web`
4. 在 **Environment variables** 填入所有 `VITE_*` 變數（見下方表格）
5. 部署完成後取得 `.pages.dev` 網域

部署後必做：
- Firebase Console → Authentication → Authorized domains → 新增 `xxx.pages.dev`
- 後端 `app/main.py` 中的 `ALLOWED_ORIGINS` 加入 Cloudflare Pages 網域並重新部署

---

## 環境變數說明

### 根目錄 `.env`（後端 + Agent 共用）

| 變數 | 必填 | 預設值 | 說明 |
|------|:----:|--------|------|
| `LIVEKIT_URL` | ✅ | — | LiveKit Cloud WebSocket URL（`wss://...`） |
| `LIVEKIT_API_KEY` | ✅ | — | LiveKit API Key |
| `LIVEKIT_API_SECRET` | ✅ | — | LiveKit API Secret |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ✅* | — | Service Account JSON 壓縮成單行字串（與 PATH 擇一） |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | ✅* | — | Service Account JSON 本機路徑（與 JSON 擇一） |
| `FIREBASE_PROJECT_ID` | ✅ | — | Firebase 專案 ID |
| `DATABASE_URL` | ✅ | `postgresql+psycopg2://tutor:tutor@postgres:5432/tutordb` | PostgreSQL 連線字串 |
| `POSTGRES_USER` | — | `tutor` | PostgreSQL 使用者名稱 |
| `POSTGRES_PASSWORD` | — | `tutor` | PostgreSQL 密碼 |
| `POSTGRES_DB` | — | `tutordb` | PostgreSQL 資料庫名稱 |
| `INTERNAL_SECRET` | ✅ | `internal-agent-secret` | Agent → Backend 內部通訊認證密鑰（請修改） |
| `OLLAMA_BASE_URL` | — | `http://192.168.15.235:11434/v1` | Ollama API 位址（OpenAI 相容） |
| `OLLAMA_MODEL` | — | `qwen3.5:35b` | 使用的 LLM 模型（可選：`gemma4:31b`、`gpt-oss:20b`） |
| `DEEPGRAM_API_KEY` | ✅ | — | Deepgram STT API Key |
| `CARTESIA_API_KEY` | ✅ | — | Cartesia TTS API Key |

### 前端 `frontend-web/.env.local`（本地開發）

| 變數 | 必填 | 說明 |
|------|:----:|------|
| `VITE_FIREBASE_API_KEY` | ✅ | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | Firebase 專案 ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ | `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | ✅ | Firebase App ID |
| `VITE_API_BASE_URL` | — | 後端 URL（本地 dev 透過 proxy 不需設定） |
| `VITE_LIVEKIT_URL` | — | LiveKit URL（本地 dev 透過 proxy 不需設定） |

---

## API 端點速查

### 公開端點（需 Firebase ID Token）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `POST` | `/auth/verify` | 驗證 Firebase token，建立/取得使用者 |
| `POST` | `/sessions/` | 建立新課程（需帶 `topic`） |
| `GET` | `/sessions/` | 列出當前使用者的所有課程 |
| `GET` | `/sessions/{id}` | 取得單一課程資訊 |
| `POST` | `/sessions/{id}/token` | 取得 LiveKit room token |
| `POST` | `/sessions/{id}/end` | 結束課程（觸發報告生成） |
| `GET` | `/sessions/{id}/report` | 查詢課後報告（`status: pending/ready`） |
| `GET` | `/sessions/{id}/messages` | 取得課程完整對話紀錄 |

### 內部端點（需 `x-internal-secret` header，僅 Agent 呼叫）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `POST` | `/internal/agent/message` | 持久化對話訊息 |
| `POST` | `/internal/agent/correction` | 持久化語法糾錯 |
| `POST` | `/internal/agent/session-ended` | 通知課程結束 |

---

## 目錄結構

```
live-english-tutor/
├── backend-fastapi/          # FastAPI 後端
│   ├── app/
│   │   ├── api/              # 路由（auth, sessions, messages, agent_callbacks）
│   │   ├── models/           # SQLAlchemy ORM 模型
│   │   ├── schemas/          # Pydantic 請求/回應 Schema
│   │   ├── services/         # 業務邏輯（livekit, report）
│   │   ├── config.py         # 設定（pydantic-settings）
│   │   ├── database.py       # SQLAlchemy engine & session
│   │   ├── firebase_app.py   # Firebase Admin SDK 初始化
│   │   └── main.py           # FastAPI App 入口
│   ├── Dockerfile
│   └── requirements.txt
├── livekit-agent/            # LiveKit AI Agent
│   ├── agent/
│   │   ├── main.py           # Worker 入口（CLI entrypoint）
│   │   ├── tutor_agent.py    # TutorAgent（AI 邏輯）
│   │   ├── state_machine.py  # 教學狀態機（WARMUP → PRACTICE → SUMMARY）
│   │   ├── prompts.py        # 各階段 System Prompt
│   │   └── backend_client.py # 呼叫後端的 HTTP client
│   ├── Dockerfile
│   └── requirements.txt
├── frontend-web/             # React + TypeScript 前端
│   ├── src/
│   │   ├── components/       # 可重用 UI 元件
│   │   │   └── lesson/       # AgentStatus / CorrectionPanel / VoiceControls
│   │   ├── pages/            # LoginPage / DashboardPage / LessonPage / ReportPage
│   │   ├── api/              # axios client + API 函式
│   │   ├── hooks/            # useAgentData（LiveKit data channel）
│   │   ├── store/            # Zustand authStore
│   │   ├── firebase.ts       # Firebase client SDK 初始化
│   │   ├── App.tsx           # onAuthStateChanged 閘門
│   │   └── router.tsx        # React Router v6（含 RequireAuth guard）
│   ├── public/_redirects     # Cloudflare Pages SPA routing
│   ├── vite.config.ts        # Dev proxy 設定
│   └── package.json
├── docs/
│   ├── PRD.md                # 產品需求文件
│   └── FRD.md                # 功能需求文件
├── docker-compose.yml        # 服務編排（postgres + backend + agent）
└── .env.example              # 環境變數範本
```

---

## 技術堆疊

| 層次 | 技術 |
|------|------|
| **前端** | React 18, TypeScript, Vite, React Router v6, Zustand, Axios, LiveKit JS SDK, Firebase SDK |
| **後端** | FastAPI, SQLAlchemy 2.0, PostgreSQL 16, Firebase Admin SDK, LiveKit API SDK |
| **AI Agent** | LiveKit Agents SDK, Silero VAD, Deepgram STT, Ollama LLM, Cartesia TTS |
| **認證** | Firebase Authentication（Google Sign-In） |
| **即時語音** | LiveKit Cloud（WebRTC） |
| **部署** | Docker Compose（後端）、Cloudflare Pages（前端） |

---

## 常見問題

**Q：Agent 沒有加入 room？**  
確認 `LIVEKIT_URL`、`LIVEKIT_API_KEY`、`LIVEKIT_API_SECRET` 正確，以及 agent 服務正常運行（`docker compose logs agent`）。

**Q：Google Sign-In 出現 `auth/unauthorized-domain` 錯誤？**  
到 Firebase Console → Authentication → Settings → Authorized domains，加入目前使用的網域（例如 `localhost` 或 `xxx.pages.dev`）。

**Q：報告一直顯示「生成中」？**  
確認 `OLLAMA_BASE_URL` 伺服器可連線，以及 `OLLAMA_MODEL` 模型已下載（`ollama pull qwen3.5:35b`）。

**Q：`CORS` 錯誤？**  
確認後端 `app/main.py` 的 `ALLOWED_ORIGINS` 已加入前端網域，並重新啟動 backend container。
