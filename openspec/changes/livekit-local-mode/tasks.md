## 0. KokoroEngine — stt-tts-unified

- [x] 0.1 在 `libs/stt-tts-unified/backend/services/kokoro_service.py` 實作 `KokoroEngine`，實作 `TTSEngine` Protocol（`list_voices`、`synthesize`、`stream_audio`）
- [x] 0.2 Kokoro ONNX inference 以 `run_in_executor` 包裝，避免 block event loop
- [x] 0.3 更新 `engine_factory.py`：加入 `engine: kokoro` 分支，回傳 `KokoroEngine`
- [x] 0.4 更新 `libs/stt-tts-unified/backend/config.py`：加入 `KokoroEngineSettings`（model_path、voices_path、voice）
- [x] 0.5 更新 `libs/stt-tts-unified/config.yaml`：加入 `tts.kokoro` 預設設定區塊

## 1. Git Submodule 設定 ✅

- [x] 1.1 移除 `libs/stt-tts-unified/` 手動複製
- [x] 1.2 以 `git submodule add` 將 stt-tts-unified repo 加入 `libs/stt-tts-unified`
- [x] 1.3 確認 `.gitmodules` 正確，並 commit submodule 設定

## 2. 依賴更新

- [x] 2.1 在 `livekit-agent/pyproject.toml` 加入 `stt-tts-unified` path dependency（`{path = "../libs/stt-tts-unified"}`）
- [x] 2.2 加入 `livekit-plugins-silero` 依賴
- [x] 2.3 加入 `livekit-agents[openai]` 以支援 Ollama OpenAI-compatible LLM
- [x] 2.4 在 `libs/stt-tts-unified/pyproject.toml` 加入 `kokoro-onnx` 為 optional dependency（`[project.optional-dependencies] kokoro = ["kokoro-onnx"]`）
- [x] 2.5 執行 `uv sync` 確認依賴正確解析

## 3. WhisperSTT Plugin

- [x] 3.1 建立 `livekit-agent/agent/plugins/__init__.py`
- [x] 3.2 建立 `livekit-agent/agent/plugins/whisper_stt.py`
- [x] 3.3 實作 `WhisperSTT(_recognize_impl)`：AudioBuffer → merge frames → WAV 暫存檔 → WhisperEngine.transcribe → SpeechEvent
- [x] 3.4 處理空白音訊情境（回傳空字串 SpeechEvent）
- [x] 3.5 處理 language 參數傳遞

## 4. KokoroTTS Plugin

- [x] 4.1 建立 `livekit-agent/agent/plugins/kokoro_tts.py`
- [x] 4.2 實作 `KokoroTTSPlugin` 及自訂 `KokoroChunkedStream`
- [x] 4.3 實作 `_run(output_emitter)`：`initialize(mime_type="audio/pcm", sample_rate=24000)` + run_in_executor 執行 Kokoro inference + 推送 PCM int16 bytes
- [x] 4.4 實作 `prewarm()`：worker 啟動時預載模型，避免第一次對話延遲
- [x] 4.5 處理 Kokoro 錯誤與例外傳遞

## 5. EdgeTTS Plugin

- [x] 5.1 建立 `livekit-agent/agent/plugins/edge_tts.py`
- [x] 5.2 實作 `EdgeTTSPlugin` 及自訂 `EdgeTTSChunkedStream`
- [x] 5.3 實作 `_run(output_emitter)`：`initialize(mime_type="audio/mpeg")` + 串流推送 MP3 bytes
- [x] 5.4 處理 Edge-TTS 錯誤（NoAudioReceived）與例外傳遞

## 6. Agent Factory

- [x] 6.1 建立 `livekit-agent/agent/agent_factory.py`
- [x] 6.2 實作 `gemini` 模式：建立 `AgentSession(llm=google.beta.realtime.RealtimeModel(...))`
- [x] 6.3 實作 `local` 模式：
  - `stt = StreamAdapter(WhisperSTT(...), vad=silero.VAD.load())`
  - `llm = openai.LLM(base_url=OLLAMA_BASE_URL, model=OLLAMA_MODEL)`
  - `tts = KokoroTTSPlugin(...)` 若 `TTS_ENGINE=kokoro`（預設）
  - `tts = EdgeTTSPlugin(...)` 若 `TTS_ENGINE=edge-tts`
- [x] 6.4 加入啟動時環境變數驗證（AGENT_MODE 無效值、local 模式缺少 OLLAMA 設定皆拋出 RuntimeError）
- [x] 6.5 加入 `TTS_ENGINE` 無效值驗證

## 7. main.py 整合

- [x] 7.1 在 `agent/main.py` 引入 `create_session` 並移除舊的 `AgentSession` 建立邏輯
- [x] 7.2 更新 `_REQUIRED_ENV` 驗證：`AGENT_MODE=local` 時才需要 `OLLAMA_BASE_URL`、`OLLAMA_MODEL`

## 8. 設定與文件

- [x] 8.1 更新 `.env.example`：加入 `AGENT_MODE=gemini`、`TTS_ENGINE=kokoro`、`OLLAMA_BASE_URL`、`OLLAMA_MODEL`
- [x] 8.2 更新 `README.md` 或 `docs/architecture.md`：說明兩種模式的切換方式，以及 TTS 引擎選項
- [x] 8.3 加入 `make update-libs` Makefile target（`git submodule update --remote libs/stt-tts-unified`）
- [x] 8.4 加入 Kokoro 模型下載說明（`kokoro-v1.0.onnx`、`voices-v1.0.bin`，各約 150MB）
