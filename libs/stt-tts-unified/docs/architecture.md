# 系統架構

## 整體架構

```
┌─────────────────────────────────────────────────────────────────┐
│  瀏覽器                                                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React + Vite（TypeScript）                              │  │
│  │                                                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │  │
│  │  │  TTSPanel  │  │  STTPanel  │  │   HistoryPanel     │ │  │
│  │  │            │  │ ┌────────┐ │  │                    │ │  │
│  │  │  文字輸入   │  │ │Upload  │ │  │  TTS + STT 紀錄    │ │  │
│  │  │  語音選擇   │  │ └────────┘ │  │  filter / 播放     │ │  │
│  │  │  播放音檔   │  │ ┌────────┐ │  │  刪除              │ │  │
│  │  │            │  │ │Recorder│ │  │                    │ │  │
│  │  │            │  │ └────────┘ │  │                    │ │  │
│  │  └────────────┘  └────────────┘  └────────────────────┘ │  │
│  │                                                          │  │
│  │  ThemeContext（light/dark）  API client（fetch）         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │ HTTP /api/*                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  FastAPI（Python 3.11）                                          │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ /api/tts/*  │  │ /api/stt/*  │  │    /api/history/*       │ │
│  │             │  │             │  │                         │ │
│  │ TTSService  │  │WhisperSvc   │  │   HistoryService        │ │
│  │             │  │FileHandler  │  │   (SQLite CRUD)         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────────┘ │
│         │                │                     │                │
│  ┌──────▼──────┐  ┌──────▼──────────────┐  ┌──▼─────────────┐  │
│  │  edge-tts   │  │  openai-whisper      │  │  SQLite        │  │
│  │ (cloud TTS) │  │  (local inference)   │  │  history.db    │  │
│  └─────────────┘  └─────────────────────┘  └────────────────┘  │
│                                                                 │
│  StaticFiles → frontend/dist（React build）                     │
└─────────────────────────────────────────────────────────────────┘
```

## 請求流程

### TTS 合成流程

```
用戶輸入文字 → POST /api/tts/synthesize
  → TTSService.synthesize(text, voice)
    → edge_tts.Communicate().stream()    # 串流到 Microsoft 伺服器
    → 寫入 data/audio/tts_*.wav + .srt
    → HistoryService.add_tts()           # 寫入 SQLite
  → 回傳 { audio_url, history_id }
→ 前端 <audio src=audio_url> 播放
```

### STT 辨識流程

```
用戶上傳/錄音 → POST /api/stt/upload
  → FileHandler.save_upload()            # UUID 命名，存 metadata JSON
  → 回傳 { file_id }

→ POST /api/stt/transcribe
  → asyncio.create_task(whisper_service.transcribe(...))  # 非阻塞背景任務
  → 立即回傳 { success: true }

→ 前端每 2 秒 GET /api/stt/status/{file_id}
  → WhisperService 更新 status JSON 檔
  → status: processing → completed

→ GET /api/stt/result/{file_id}
  → 讀取 data/results/{file_id}_text.txt
  → 回傳 { text, word_count, char_count }
```

### 異步架構重點

```
FastAPI event loop（單執行緒）
│
├── HTTP 請求處理（非阻塞）
├── edge-tts 串流（原生 async）
├── aiosqlite 查詢（原生 async）
├── aiofiles 讀寫（原生 async）
│
└── asyncio.create_task()
      └── Whisper 背景任務
            └── run_in_executor()  ← 在 ThreadPoolExecutor 執行阻塞呼叫
                  └── model.transcribe()  ← CPU-bound，不阻塞 event loop
```

## 資料模型

### SQLite 資料表

```sql
-- TTS 歷史
CREATE TABLE tts_history (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at     TEXT    NOT NULL,   -- ISO 8601 UTC
    text           TEXT    NOT NULL,   -- 輸入文字
    voice          TEXT    NOT NULL,   -- 語音名稱
    audio_filename TEXT    NOT NULL,   -- data/audio/ 下的檔名
    srt_filename   TEXT               -- 字幕檔名（可空）
);

-- STT 歷史
CREATE TABLE stt_history (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at        TEXT    NOT NULL,
    original_filename TEXT    NOT NULL,  -- 原始上傳檔名
    audio_filename    TEXT    NOT NULL,  -- data/uploads/ 下的 UUID 檔名
    transcript        TEXT    NOT NULL,  -- 辨識結果文字
    model_size        TEXT    NOT NULL,  -- tiny/base/small/medium/large
    language          TEXT    NOT NULL,  -- auto/zh/en/...
    processing_time   REAL               -- 秒數
);
```

### 檔案結構（執行期）

```
data/
├── uploads/
│   ├── {uuid}.mp3               上傳的音訊檔
│   ├── {uuid}_metadata.json     {original_filename, stored_filename, file_size}
│   └── {uuid}_status.json       {status, progress, stage, message, timestamp}
├── results/
│   └── {uuid}_text.txt          Whisper 辨識結果
└── audio/
    ├── tts_{timestamp}.wav      TTS 合成音檔
    └── tts_{timestamp}.srt      對應字幕
```

## 前端狀態機

### STT 轉換狀態流

```
idle
 │
 ├─[選擇/錄音檔案]──→ uploading
 │                      │
 │                   success → file_ready
 │                      │
 │                   [點擊「開始轉換」]
 │                      │
 │                   starting
 │                      │
 │               ┌── processing ──────┐
 │               │   (polling 2s)     │
 │               │   progress: 0→100  │
 │               └────────────────────┘
 │                      │
 │               ┌──────┴──────┐
 │           completed        error
 │               │
 │           [顯示結果]
 │               │
 └─[「再轉一個」]──→ idle
```

## Docker 建置流程

```
Dockerfile（multi-stage）

Stage 1: node:20-alpine
  COPY frontend/package*.json
  RUN npm ci
  COPY frontend/
  RUN npm run build
  → /app/frontend/dist/

Stage 2: python:3.11-slim
  RUN apt install ffmpeg
  RUN pip install torch (CPU-only) + requirements.txt
  COPY backend/
  COPY --from=Stage1 /app/frontend/dist ./frontend/dist
  RUN python -c "whisper.load_model('base')"  ← pre-download model
  CMD uvicorn backend.main:app
```

### Volume 掛載

| Volume | Container 路徑 | 用途 |
|---|---|---|
| `./data` | `/app/data` | 上傳檔、結果、音檔、SQLite DB |
| `./whisper-cache` | `/root/.cache/whisper` | Whisper 模型快取 |

## 設計決策紀錄

| 決策 | 選擇 | 理由 |
|---|---|---|
| STT 即時錄音方式 | 完整錄音後 POST | Whisper 不支援 streaming inference |
| 歷史儲存 | SQLite (aiosqlite) | 單檔、異步、可查詢，不需獨立 DB server |
| Whisper 異步 | run_in_executor | CPU-bound，必須離開 event loop |
| 前端框架 | React + Vite | 生態成熟，Vite 建置快速 |
| 後端框架 | 單一 FastAPI | 兩個原 repo 都是 FastAPI，合併最自然 |
| Docker 策略 | Multi-stage 單 container | 規模不需微服務，部署最簡單 |
| CSS 架構 | CSS Variables（Apple HIG）| 無額外依賴，原生 dark mode 支援 |
