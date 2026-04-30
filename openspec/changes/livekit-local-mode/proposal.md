## Why

目前 livekit-agent 只支援 Gemini Realtime 一種模式（STT + LLM + TTS 全包），無法在不同部署情境下切換語音處理引擎。每次對話皆依賴 Google Gemini API，產生 API 費用。加入 local 模式可讓 agent 在完全不依賴外部 AI 服務的環境中運行，重用既有的 stt-tts-unified 引擎，並以開源模型取代付費 API。

## What Changes

- ~~將 `libs/stt-tts-unified/` 從手動複製改為 git submodule，指向 stt-tts-unified repo~~ **已完成**
- 在 `libs/stt-tts-unified` 新增 `KokoroEngine`（`kokoro_service.py`），實作 `TTSEngine` Protocol
- `livekit-agent/pyproject.toml` 加入 `stt-tts-unified` path dependency 及 `livekit-plugins-silero`
- 新增 `agent/plugins/whisper_stt.py`：將 WhisperEngine 包裝為 `livekit.agents.stt.STT`
- 新增 `agent/plugins/kokoro_tts.py`：將 KokoroEngine 包裝為 `livekit.agents.tts.TTS`
- 新增 `agent/plugins/edge_tts.py`：將 EdgeTTSEngine 包裝為 `livekit.agents.tts.TTS`（可選，需網路）
- 新增 `agent/agent_factory.py`：根據 `AGENT_MODE` 建立對應的 `AgentSession`
- 修改 `agent/main.py`：改用 `agent_factory` 建立 session
- 更新 `.env.example`：加入 `AGENT_MODE` 設定

## Capabilities

### New Capabilities

- `livekit-local-mode`: 透過 `AGENT_MODE=local` 啟用本地語音模式，使用 Whisper STT + Ollama LLM；TTS 可選 Kokoro（完全離線）或 EdgeTTS（品質優先）
- `agent-mode-switching`: 以環境變數切換模式（`AGENT_MODE=gemini/local`）及 TTS 引擎（`TTS_ENGINE=kokoro/edge-tts`），無需修改程式碼

### Modified Capabilities

- `stt-tts-unified`：新增 `KokoroEngine`（自架 TTS，Apache 2.0），可選替代 EdgeTTSEngine

## Impact

- **`livekit-agent/`**：新增 plugins 模組、agent_factory；main.py 小改
- **`libs/stt-tts-unified/`**：新增 KokoroEngine 實作（不影響現有 EdgeTTS / Whisper 行為）
- **依賴**：新增 `livekit-plugins-silero`（VAD）、`kokoro-onnx`（TTS）、`stt-tts-unified`（path dep）
- **現有 gemini 模式**：行為完全不變，`AGENT_MODE` 預設值為 `gemini`
