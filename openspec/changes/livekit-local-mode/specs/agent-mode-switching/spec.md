## ADDED Requirements

### Requirement: AGENT_MODE 環境變數
系統 SHALL 讀取 `AGENT_MODE` 環境變數決定 AgentSession 的組成，預設值為 `gemini`。

#### Scenario: 預設模式（未設定 AGENT_MODE）
- **WHEN** `AGENT_MODE` 未設定或為空
- **THEN** agent 以 `gemini` 模式啟動，行為與現有完全相同

#### Scenario: 明確設定 gemini 模式
- **WHEN** `AGENT_MODE=gemini`
- **THEN** 建立 `AgentSession(llm=google.beta.realtime.RealtimeModel(...))`，不載入 WhisperSTT 或任何 TTS plugin

#### Scenario: 設定 local 模式（預設 TTS）
- **WHEN** `AGENT_MODE=local` 且 `TTS_ENGINE` 未設定或為 `kokoro`
- **THEN** 建立 `AgentSession(stt=StreamAdapter(WhisperSTT, SileroVAD), llm=OllamaLLM, tts=KokoroTTSPlugin)`

#### Scenario: 設定 local 模式並使用 Edge-TTS
- **WHEN** `AGENT_MODE=local` 且 `TTS_ENGINE=edge-tts`
- **THEN** 建立 `AgentSession(stt=StreamAdapter(WhisperSTT, SileroVAD), llm=OllamaLLM, tts=EdgeTTSPlugin)`

#### Scenario: 無效的 AGENT_MODE
- **WHEN** `AGENT_MODE` 設為未知值（如 `AGENT_MODE=foo`）
- **THEN** worker 啟動時拋出 `RuntimeError`，明確列出有效值 `["gemini", "local"]`

#### Scenario: 無效的 TTS_ENGINE
- **WHEN** `TTS_ENGINE` 設為未知值（如 `TTS_ENGINE=bark`）
- **THEN** worker 啟動時拋出 `RuntimeError`，明確列出有效值 `["kokoro", "edge-tts"]`

---

### Requirement: agent_factory 模組
系統 SHALL 提供 `agent/agent_factory.py` 模組，集中管理各模式的 `AgentSession` 建立邏輯，`main.py` 透過 `create_session(mode)` 呼叫。

#### Scenario: main.py 呼叫 agent_factory
- **WHEN** `entrypoint` 執行
- **THEN** 呼叫 `create_session(os.getenv("AGENT_MODE", "gemini"))` 取得 AgentSession，`main.py` 不包含任何引擎建立邏輯

---

### Requirement: local 模式的 Ollama LLM 設定
系統 SHALL 在 local 模式下以 `OLLAMA_BASE_URL` 和 `OLLAMA_MODEL` 環境變數建立 Ollama LLM。

#### Scenario: local 模式使用 Ollama
- **WHEN** `AGENT_MODE=local`
- **THEN** LLM 使用 `openai.LLM(base_url=OLLAMA_BASE_URL, model=OLLAMA_MODEL)`（OpenAI-compatible API）

#### Scenario: local 模式缺少 Ollama 設定
- **WHEN** `AGENT_MODE=local` 且 `OLLAMA_BASE_URL` 或 `OLLAMA_MODEL` 未設定
- **THEN** worker 啟動時拋出 `RuntimeError`，提示缺少必要環境變數

---

### Requirement: local 模式的 TTS_ENGINE 設定
系統 SHALL 在 local 模式下以 `TTS_ENGINE` 環境變數選擇 TTS 引擎，預設為 `kokoro`。

#### Scenario: TTS_ENGINE=kokoro（預設）
- **WHEN** `AGENT_MODE=local` 且 `TTS_ENGINE` 未設定或為 `kokoro`
- **THEN** 使用 `KokoroTTSPlugin`，完全本地執行，無外部網路需求

#### Scenario: TTS_ENGINE=edge-tts
- **WHEN** `AGENT_MODE=local` 且 `TTS_ENGINE=edge-tts`
- **THEN** 使用 `EdgeTTSPlugin`，呼叫 Microsoft Edge TTS API（需要網路）
