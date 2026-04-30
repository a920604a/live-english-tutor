## ADDED Requirements

### Requirement: KokoroEngine in stt-tts-unified
系統 SHALL 在 `libs/stt-tts-unified/backend/services/kokoro_service.py` 提供 `KokoroEngine` class，實作 `TTSEngine` Protocol。

#### Scenario: 成功合成語音（synthesize）
- **WHEN** `synthesize(text, voice)` 被呼叫
- **THEN** 在 executor 中執行 Kokoro ONNX inference，回傳 `(audio_filename, "")` tuple（無 SRT）

#### Scenario: 串流合成（stream_audio）
- **WHEN** `stream_audio(text, voice)` 被呼叫
- **THEN** yield PCM int16 bytes chunks（單次 yield 全部結果，Kokoro 不原生串流）

#### Scenario: 列出語音
- **WHEN** `list_voices()` 被呼叫
- **THEN** 回傳 Kokoro 支援的語音清單（hardcoded，包含 name、gender、locale）

---

### Requirement: WhisperSTT plugin
系統 SHALL 提供 `WhisperSTT` class，繼承 `livekit.agents.stt.STT`，將 WhisperEngine 的 batch 轉錄能力暴露為 LiveKit STT 介面。

#### Scenario: 成功轉錄音訊片段
- **WHEN** `_recognize_impl` 收到 `AudioBuffer`（已由 VAD 分段）
- **THEN** 合併 frames 為 WAV 暫存檔，呼叫 WhisperEngine.transcribe，回傳含轉錄文字的 `SpeechEvent(type=FINAL_TRANSCRIPT)`

#### Scenario: 空白音訊
- **WHEN** `_recognize_impl` 收到無語音內容的 `AudioBuffer`
- **THEN** 回傳 `SpeechEvent(type=FINAL_TRANSCRIPT, alternatives=[SpeechData(text="")])`

#### Scenario: 語言設定
- **WHEN** `language` 參數有值（如 `"zh"`）
- **THEN** 傳入 WhisperEngine.transcribe 的 language 參數，覆蓋預設 `auto`

---

### Requirement: KokoroTTSPlugin
系統 SHALL 提供 `KokoroTTSPlugin` class，繼承 `livekit.agents.tts.TTS`，將 KokoroEngine 暴露為 LiveKit TTS 介面。

#### Scenario: 成功合成語音
- **WHEN** `synthesize(text)` 被呼叫
- **THEN** 回傳 `ChunkedStream`，在 executor 中執行 Kokoro inference，透過 `AudioEmitter(mime_type="audio/pcm", sample_rate=24000)` 推送 PCM int16 bytes

#### Scenario: 模型預載（prewarm）
- **WHEN** worker 啟動，`prewarm()` 被呼叫
- **THEN** 預先載入 Kokoro ONNX 模型至記憶體，第一次對話不需等待模型載入

#### Scenario: 指定語音
- **WHEN** KokoroTTSPlugin 以 `voice` 參數初始化
- **THEN** 所有合成請求使用該語音

---

### Requirement: EdgeTTSPlugin
系統 SHALL 提供 `EdgeTTSPlugin` class，繼承 `livekit.agents.tts.TTS`，將 EdgeTTSEngine 的音訊合成能力暴露為 LiveKit TTS 介面。

#### Scenario: 成功合成語音
- **WHEN** `synthesize(text)` 被呼叫
- **THEN** 回傳 `ChunkedStream`，迭代時推送 Edge-TTS MP3 bytes 並透過 `AudioEmitter(mime_type="audio/mpeg")` 解碼為 PCM frames

#### Scenario: 指定語音
- **WHEN** EdgeTTSPlugin 以 `voice` 參數初始化
- **THEN** 所有合成請求使用該語音，不使用 EdgeTTSEngine 的 default_voice

#### Scenario: TTS 服務失敗
- **WHEN** Edge-TTS 回傳錯誤或 NoAudioReceived
- **THEN** ChunkedStream 拋出例外，由 livekit-agents 框架處理重試

---

### Requirement: Silero VAD 串流適配
系統 SHALL 將 `WhisperSTT` 透過 `StreamAdapter(stt=WhisperSTT(), vad=silero.VAD.load())` 包裝後傳入 `AgentSession`，以支援即時音訊串流輸入。

#### Scenario: VAD 偵測到說話結束
- **WHEN** Silero VAD 偵測到靜音（說話片段結束）
- **THEN** StreamAdapter 將該片段的 AudioBuffer 送入 WhisperSTT._recognize_impl，結果透過 RecognizeStream 發送
