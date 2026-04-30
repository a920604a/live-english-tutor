## Context

livekit-agent 目前以單一模式運行：`AgentSession(llm=google.beta.realtime.RealtimeModel(...))` — Gemini Realtime 將 STT、LLM、TTS 融合在一個原生音訊模型中，無法拆開替換。

stt-tts-unified 是本地語音處理服務，提供 WhisperEngine（本地 STT）與 EdgeTTSEngine（Microsoft Edge TTS）。目前以 HTTP API 對外提供服務，在 `live-english-tutor/libs/stt-tts-unified/` 有一份手動維護的副本。

目標是讓 agent 在 `AGENT_MODE=local` 時改用完全本地引擎（無任何外部 API 依賴），`AGENT_MODE=gemini`（預設）時行為不變。

`libs/stt-tts-unified` 已以 git submodule 方式引入（已完成）。

## Goals / Non-Goals

**Goals:**
- 新增 `AGENT_MODE=local` 支援：Whisper STT + Ollama LLM + Kokoro TTS（完全本地，無外部 API）
- `AGENT_MODE=gemini` 完全向後相容，行為不變
- 在 `libs/stt-tts-unified` 加入 `KokoroEngine`，實作 `TTSEngine` Protocol
- `libs/stt-tts-unified/` 已改用 git submodule 管理（已完成）

**Non-Goals:**
- 細粒度引擎切換（只有 gemini / local 兩個 preset）
- 對 stt-tts-unified HTTP API 的任何修改
- 新增 UI 或 runtime 動態切換
- streaming STT（Whisper 為 batch 模式，透過 VAD 分段）
- Edge-TTS 整合（依賴 Microsoft 外部服務，不符合完全自架目標）

## Decisions

### D1：Plugin 放在 live-english-tutor，KokoroEngine 放在 stt-tts-unified

**選擇：**
- LiveKit plugin wrappers（`WhisperSTT`、`KokoroTTS`）放在 `livekit-agent/agent/plugins/`
- `KokoroEngine` 實作（引擎邏輯）放在 `libs/stt-tts-unified/backend/services/kokoro_service.py`

**理由：** stt-tts-unified 管理引擎邏輯（與 HTTP API / 歷史紀錄整合），不應依賴 livekit-agents。plugin wrappers 是 live-english-tutor 的整合層，負責 LiveKit 介面適配，thin wrapper 約 50 行。KokoroEngine 加入 stt-tts-unified 後，未來 stt-tts-unified HTTP API 也可選用 Kokoro 取代 EdgeTTS。

**備選方案：** 在 stt-tts-unified 加入 optional livekit dependency → 拒絕，增加核心服務的依賴複雜度。

---

### D2：stt-tts-unified 以 git submodule 引入

**選擇：** `libs/stt-tts-unified` 改為 git submodule + pyproject.toml path dependency

**理由：** 版本可追蹤，不需手動同步。path dependency 讓 Python import 直接使用引擎 class，無 HTTP 延遲。

**備選方案：** HTTP plugin（呼叫 /api/stt、/api/tts）→ 拒絕，增加網路延遲且需維護 API schema 一致性。

---

### D3：WhisperSTT 使用 batch recognize + StreamAdapter + Silero VAD

**選擇：** 實作 `_recognize_impl(AudioBuffer)`，對外用 `StreamAdapter(stt=WhisperSTT(), vad=silero.VAD.load())` 包裝

**理由：** Whisper 不支援 streaming，需要 VAD 偵測說話片段結束後再做 batch 轉錄。LiveKit 提供 `StreamAdapter` 處理此模式，Silero VAD 是 livekit-agents 生態系的標準選擇。

音訊轉換：`AudioBuffer`（list of `rtc.AudioFrame`） → merge frames → numpy array → WAV 暫存檔 → Whisper transcribe

---

### D4：KokoroTTSPlugin 使用 ChunkedStream + audio/pcm mime type

**選擇：** 實作 `synthesize()` 回傳自訂 `ChunkedStream`，在 `_run()` 中透過 `output_emitter.initialize(mime_type="audio/pcm", sample_rate=24000)` 推送 PCM int16 bytes

**理由：** Kokoro ONNX（`kokoro-onnx`）直接輸出 float32 PCM，轉換為 int16 bytes 後以 `audio/pcm` 推入 `AudioEmitter`，`AudioEmitter` 直接處理 raw PCM，無解碼開銷，延遲最低。CPU 上短句（<20字）約 100-200ms，英語教學情境可接受。

Kokoro 為阻塞式同步呼叫（ONNX inference），需在 `asyncio.get_event_loop().run_in_executor(None, ...)` 中執行以避免 block event loop。

**備選方案：** EdgeTTSPlugin → 拒絕，依賴 Microsoft 外部服務，不符合完全自架目標。

---

### D5：KokoroEngine 加入 stt-tts-unified，實作 TTSEngine Protocol

**選擇：** 新增 `libs/stt-tts-unified/backend/services/kokoro_service.py`，`KokoroEngine` 實作 `TTSEngine` Protocol；更新 `engine_factory.py` 加入 `engine: kokoro` 分支

**理由：** 統一引擎管理，`KokoroEngine` 加入後 stt-tts-unified HTTP API 也可選用，與現有 `WhisperEngine` / `EdgeTTSEngine` 結構一致。`TTSEngine` Protocol 的 `stream_audio()` 和 `synthesize()` 對 Kokoro 均可實作。

**備選方案：** KokoroEngine 僅在 livekit-agent 實作 → 拒絕，引擎邏輯應集中在 stt-tts-unified。

---

### D6（補充）：TTS_ENGINE 環境變數切換 local 模式的 TTS 引擎

**選擇：** 在 `AGENT_MODE=local` 下，以 `TTS_ENGINE` 環境變數選擇 TTS 引擎，預設 `kokoro`

| `TTS_ENGINE` | 引擎 | 自架 | 需要網路 |
|---|---|:---:|:---:|
| `kokoro`（預設）| KokoroTTSPlugin（Kokoro ONNX）| ✅ | ❌ |
| `edge-tts` | EdgeTTSPlugin（Microsoft Edge API）| ❌ | ✅ |

**理由：** 兩種情境都有需求—開發期或品質優先時用 EdgeTTS（品質略好），生產完全離線部署時用 Kokoro。以環境變數切換，不需改 code。兩個 plugin 都實作 `livekit.agents.tts.TTS` 介面，`agent_factory` 只需 `if/else` 選擇。

---

### D7：agent_factory.py 集中管理模式切換

**選擇：** 新增 `agent/agent_factory.py`，`main.py` 只呼叫 `create_session(AGENT_MODE)`

**理由：** 將模式邏輯從 entrypoint 分離，方便測試與未來擴充。`main.py` 保持最小改動。

## Risks / Trade-offs

| 風險 | 說明 | 緩解 |
|------|------|------|
| Whisper 延遲 | Batch 模式在說話結束後才開始轉錄，延遲比 streaming STT 高（約 1-3s on base model） | local 模式本就定位為離線/低成本替代方案，延遲可接受；可改用 tiny 模型降低延遲 |
| Silero VAD 誤判 | 靜音偵測可能切斷句子 | 使用 silero 預設參數，後續可調整靜音 threshold |
| submodule 版本漂移 | livekit-agent 釘住 submodule commit，stt-tts-unified 更新需手動 pull | 加入 `make update-libs` target 提醒更新 |
| Kokoro 模型首次載入慢 | ONNX 模型（~300MB）首次載入約 2-5s | worker 啟動時 prewarm，不影響對話延遲 |
| Kokoro CPU 延遲 | 長句（>50字）在慢速 CPU 上可能超過 500ms | 英語教學情境句子通常短，可接受；或以 Piper 替換 |

## Migration Plan

1. ~~將 `libs/stt-tts-unified/` 轉為 git submodule~~ **已完成**
2. 在 `libs/stt-tts-unified` 加入 `KokoroEngine`（`kokoro_service.py`）
3. 更新 `livekit-agent/pyproject.toml`，加入新依賴
4. 實作 `agent/plugins/whisper_stt.py`、`agent/plugins/kokoro_tts.py`、`agent/plugins/edge_tts.py`
5. 實作 `agent/agent_factory.py`
6. 更新 `main.py`
7. 更新 `.env.example` 與 `README.md`
8. 驗證：`AGENT_MODE=gemini` 行為不變；`AGENT_MODE=local` 可正常啟動（分別測試 `TTS_ENGINE=kokoro` 與 `TTS_ENGINE=edge-tts`）

**Rollback：** `AGENT_MODE` 預設 `gemini`，若 local 模式有問題直接移除環境變數即可回到現有行為。

## Open Questions

- Ollama model 名稱沿用現有 `OLLAMA_MODEL` env var（已在 `.env.example` 定義）
