# 開發指南

## 環境需求

| 工具 | 版本 | 說明 |
|---|---|---|
| Python | 3.11+ | 後端執行環境 |
| Node.js | 20+ | 前端建置工具 |
| ffmpeg | 任意 | Whisper 音訊解碼必要 |
| Docker | 20+ | 容器部署（可選）|

### 安裝 ffmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg

# Windows（Chocolatey）
choco install ffmpeg
```

---

## 快速上手

```bash
# 1. 安裝所有依賴
make install

# 2. 啟動開發伺服器（後端 + 前端同時啟動）
make dev
```

| 服務 | URL |
|---|---|
| 前端（Vite dev server） | http://localhost:5173 |
| 後端（FastAPI） | http://localhost:8080 |
| API 互動文件 | http://localhost:8080/docs |

> 開發模式下，前端透過 Vite proxy 將 `/api/*` 請求轉發至後端，CORS 不會有問題。

---

## 環境變數

複製 `.env.example` 為 `.env`：

```bash
cp .env.example .env
```

| 變數 | 預設值 | 說明 |
|---|---|---|
| `UPLOAD_DIR` | `data/uploads` | 上傳音檔存放目錄 |
| `RESULT_DIR` | `data/results` | Whisper 結果存放目錄 |
| `AUDIO_DIR` | `data/audio` | TTS 音檔存放目錄 |
| `DB_PATH` | `data/history.db` | SQLite 資料庫路徑 |
| `DEFAULT_WHISPER_MODEL` | `base` | 啟動時預載入的模型 |
| `DEFAULT_TTS_VOICE` | `zh-TW-YunJheNeural` | 預設 TTS 語音 |
| `MAX_FILE_SIZE_MB` | `500` | 上傳檔案大小上限（MB）|
| `DEV_MODE` | `false` | 開啟 CORS（本地開發用）|

---

## 常用指令

```bash
make help           # 顯示所有指令說明
make install        # 安裝依賴
make dev            # 啟動後端 + 前端
make dev-backend    # 僅啟動後端（hot-reload）
make dev-frontend   # 僅啟動前端
make build          # 建置 React 前端 → frontend/dist/
make lint           # 執行 ruff + tsc 型別檢查
make fmt            # 自動格式化 Python + TypeScript
make clean          # 移除建置產物
make clean-data     # 清除所有執行期資料（謹慎使用）
make up             # docker compose up --build
make down           # docker compose down
make logs           # 追蹤 docker 日誌
make shell          # 進入 container shell
```

---

## 後端架構

```
backend/
├── main.py          FastAPI app factory；掛載 router 與 StaticFiles
├── config.py        pydantic-settings 集中管理環境變數
├── database.py      aiosqlite 連線池；建立 tts_history / stt_history 表
├── routers/
│   ├── tts.py       /api/tts/* — 語音合成
│   ├── stt.py       /api/stt/* — 語音辨識
│   └── history.py   /api/history/* — 歷史紀錄
├── services/
│   ├── tts_service.py       TTSService（edge-tts 封裝）
│   ├── whisper_service.py   WhisperService（Whisper 異步封裝）
│   └── history_service.py   HistoryService（SQLite CRUD）
└── utils/
    └── file_handler.py      檔案上傳、狀態追蹤、元資料管理
```

### 異步 Whisper 執行

`model.transcribe()` 是 CPU-bound 阻塞呼叫，**必須**用 `asyncio.run_in_executor` 包裝，否則會凍結 FastAPI event loop：

```python
loop = asyncio.get_event_loop()
result = await loop.run_in_executor(
    None,                              # 使用預設 ThreadPoolExecutor
    lambda: model.transcribe(path)     # 阻塞呼叫包在 lambda
)
```

轉換任務透過 `asyncio.create_task()` 在背景執行，前端透過 polling 每 2 秒查詢進度。

---

## 前端架構

```
frontend/src/
├── App.tsx                  根元件（ThemeProvider wraps AppShell）
├── context/
│   └── ThemeContext.tsx     Dark mode 狀態（localStorage 持久化）
├── api/
│   ├── tts.ts               TTS API 呼叫
│   ├── stt.ts               STT API 呼叫（upload / transcribe / poll）
│   └── history.ts           History API 呼叫
├── styles/
│   └── globals.css          Apple HIG CSS 變數（light + dark token）
└── components/
    ├── Layout/AppShell.tsx  Header + Tab Nav + Theme Toggle
    ├── TTS/TTSPanel.tsx     文字輸入 → 合成 → 播放
    ├── STT/
    │   ├── STTPanel.tsx     Tab 容器（上傳 / 錄音）+ 設定
    │   ├── FileUpload.tsx   拖曳上傳
    │   ├── Recorder.tsx     MediaRecorder 即時錄音
    │   └── ProgressPoller.tsx  進度輪詢 + 結果顯示
    └── History/
        ├── HistoryPanel.tsx 列表 + filter
        └── HistoryItem.tsx  展開 / 播放 / 刪除
```

### Dark Mode

所有顏色使用 CSS 變數，**不使用** hardcoded hex 值：

```css
/* 正確 */
color: var(--color-label);
background: var(--color-bg-secondary);

/* 錯誤 */
color: #333;
background: #f5f5f5;
```

切換主題時，只需切換 `document.documentElement` 的 `data-theme` 屬性：

```ts
document.documentElement.setAttribute('data-theme', 'dark')
```

---

## 新增語言支援

STT 語言選單位於 [`STTPanel.tsx`](../frontend/src/components/STT/STTPanel.tsx)，新增 `<option>` 即可：

```tsx
<option value="fr">Français</option>
```

Whisper 支援 99 種語言，完整列表見 [openai/whisper](https://github.com/openai/whisper#available-models-and-languages)。

---

## 新增 TTS 引擎

1. 在 `backend/services/` 新增 `new_tts_service.py`
2. 在 `backend/routers/tts.py` 新增路由（建議加 query param `engine=edge|new`）
3. 在 `frontend/src/api/tts.ts` 新增對應的 fetch 函數
4. 在 `TTSPanel.tsx` 新增引擎切換 UI

---

## 常見問題

### ffmpeg 找不到

```
Error: ffmpeg not found
```

確認 ffmpeg 已安裝並在 PATH 中：

```bash
ffmpeg -version
```

### Whisper 模型下載很慢

模型第一次使用時會從 HuggingFace 下載，快取位於 `~/.cache/whisper`。  
Docker 環境中已透過 `./whisper-cache` volume 持久化，重建 image 不需重新下載。

### Docker image 很大

包含 PyTorch CPU 版本約 ~3 GB。  
若需要 GPU 支援，修改 `Dockerfile` 中的 torch 安裝指令，移除 `--index-url` 改用 CUDA 版本。

### 前端 API 呼叫 404

確認後端已啟動，且 `vite.config.ts` 中的 proxy 設定正確：

```ts
proxy: {
  '/api': { target: 'http://localhost:8080', changeOrigin: true }
}
```
