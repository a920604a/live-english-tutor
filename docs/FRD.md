# FRD — 功能需求文件（Functional Requirements Document）

**產品**：Live English Tutor  
**版本**：v0.1 MVP  
**日期**：2026-04-10  
**依據**：PRD v0.1

---

## 1. 系統角色定義

| 角色 | 說明 |
|------|------|
| **Student（學生）** | 已登入的系統使用者，透過 Web 瀏覽器進行語音課程 |
| **Emma（AI 老師）** | LiveKit Agent，在每個課程房間中扮演英文老師 |
| **System（系統）** | FastAPI Backend，管理課程生命週期、持久化資料、觸發報告生成 |

### 1.1 房間模型（Room Model）

> **核心設計：一個 LiveKit Room = 一位學生 + 一個 Emma Agent**

```
LiveKit Room: "session-{session_id}"
├── Participant 1: user-{user_id}   （學生）
│     - 發布麥克風音訊（audio track）
│     - 訂閱 Agent 語音
│     - 接收 Data Channel（糾錯 / 狀態事件）
│
└── Participant 2: Emma Agent        （AI 老師）
      - 訂閱學生麥克風音訊
      - 發布 TTS 語音
      - 發布 Data Channel 事件
```

- Room 名稱由後端建立 Session 後確定，格式：`session-{session_id}`
- 學生透過 `POST /sessions/{id}/token` 取得 LiveKit token 後加入
- Emma Agent Worker 監聽 LiveKit Cloud 新 Room 事件，自動加入
- 第三方不得加入同一 Room（LiveKit Cloud 透過 token 限制）

---

## 2. 身分驗證模組


### FR-AUTH-01：使用者註冊

| 項目 | 規格 |
|------|------|
| **端點** | `POST /auth/register` |
| **輸入** | `{email: string, password: string, full_name?: string}` |
| **驗證** | email 唯一性（否則 400）；password 非空 |
| **處理** | bcrypt hash password → 建立 User 紀錄 |
| **輸出** | `{id, email, full_name}` |
| **HTTP** | 201 Created / 400 Bad Request |

### FR-AUTH-02：使用者登入

| 項目 | 規格 |
|------|------|
| **端點** | `POST /auth/login` |
| **輸入** | `{email: string, password: string}` |
| **處理** | 查找 User → bcrypt verify → 生成 JWT（HS256，exp: +24h，sub: user_id） |
| **輸出** | `{access_token: string, token_type: "bearer"}` |
| **HTTP** | 200 OK / 401 Unauthorized |

### FR-AUTH-03：API Token 驗證

- 所有 `/sessions/*` 路由需帶 `Authorization: Bearer <token>`
- Middleware 解碼 JWT → 取得 `sub`（user_id）→ 查 DB 取 User 物件
- Token 過期或格式錯誤 → **401 Unauthorized**

---

## 3. 課程管理模組

### FR-SESSION-01：建立課程

| 項目 | 規格 |
|------|------|
| **端點** | `POST /sessions/` |
| **觸發** | 學生點擊 Dashboard 上的主題按鈕 |
| **輸入** | `{topic: string}` |
| **處理** | INSERT TutorSession（status=PENDING）→ UPDATE room_name=`"session-{id}"` |
| **輸出** | SessionOut |
| **HTTP** | 201 Created |

**Session 狀態機**：
```
PENDING → ACTIVE（學生取得 Token 時）→ ENDED（學生點 End / Agent 關閉）
```

### FR-SESSION-02：取得 LiveKit Token

| 項目 | 規格 |
|------|------|
| **端點** | `POST /sessions/{id}/token` |
| **觸發** | LessonPage `useEffect` 初始化時 |
| **驗證** | Session 歸屬當前使用者；status ≠ ENDED |
| **處理** | Session.status → ACTIVE；生成 LiveKit AccessToken |
| **Token Grants** | `room_join=True, room={room_name}, can_publish=True, can_subscribe=True` |
| **Token Identity** | `user-{user_id}` |
| **輸出** | `{token: string, url: string}` |
| **HTTP** | 200 OK |

### FR-SESSION-03：結束課程

| 項目 | 規格 |
|------|------|
| **端點** | `POST /sessions/{id}/end` |
| **觸發** | 學生點擊「End Lesson」按鈕 |
| **處理** | status → ENDED；ended_at = NOW()；觸發 BackgroundTask（報告生成） |
| **輸出** | SessionOut（含 ended_at） |
| **HTTP** | 200 OK |

### FR-SESSION-04：查詢課後報告

| 項目 | 規格 |
|------|------|
| **端點** | `GET /sessions/{id}/report` |
| **輸出（pending）** | `{"status": "pending", "report": null}` |
| **輸出（ready）** | `{"status": "ready", "report": "<Markdown 文字>"}` |
| **前端行為** | 每 3 秒輪詢，直到 status="ready" |

### FR-SESSION-05：列出歷史課程

| 項目 | 規格 |
|------|------|
| **端點** | `GET /sessions/` |
| **排序** | created_at DESC |
| **回傳** | `List[SessionOut]`（僅當前使用者的課程） |

---

## 4. AI 老師（Emma Agent）模組

### FR-AGENT-01：Agent Worker 啟動

```
python -m agent.main start
```

Agent Worker 持續連線 LiveKit Cloud，監聽 dispatch 事件。
當有新的 `session-*` Room 被建立時，自動呼叫 `entrypoint(ctx)`。

### FR-AGENT-02：Entrypoint 初始化流程

```
entrypoint(ctx: JobContext)
  1. await ctx.connect()                          # 加入 Room
  2. session_id = parse("session-{N}" → N)        # 從 room name 取 session_id
  3. topic = ctx.room.metadata or "general"        # 從 room metadata 取主題
  4. backend = BackendClient(session_id)
  5. agent = TutorAgent(session_id, backend, topic)
  6. session = AgentSession(vad, stt, llm, tts)
  7. session.start(agent=agent, room=ctx.room)
  8. await session.generate_reply(greeting_instructions)  # 開場白
```

### FR-AGENT-03：Emma 開場白

**觸發**：`session.generate_reply()` 在 Agent 加入後立即執行

**Instruction**：
> "Greet the student warmly by name if possible, introduce yourself as Emma, and begin the warm-up phase with a friendly opening question."

**預期回應範例**：
> "Hi there! I'm Emma, your English tutor today. It's great to meet you! How are you feeling today? Is there anything exciting happening in your life lately?"

### FR-AGENT-04：語音對話流程（每輪）

```
┌─────────────────────────────────────────────────────────────────┐
│  學生說話（麥克風）                                              │
│    ↓ Silero VAD 偵測到語音結束                                  │
│    ↓ Deepgram nova-3 STT 轉文字                                 │
│  [user_input_transcribed event, is_final=True]                  │
│    ↓                                                            │
│  1. sm.advance()           → 更新 turn_count & 檢查狀態轉移     │
│  2. backend.post_message() → 持久化 student 訊息               │
│    ↓                                                            │
│  LLM (Ollama qwen3.5:35b) 推理                                 │
│    ↓（可能呼叫 function tools：record_correction / advance）    │
│  [agent_speech_committed event]                                 │
│    ↓                                                            │
│  3. backend.post_message() → 持久化 tutor 回應                 │
│    ↓ Cartesia TTS 合成語音                                      │
│  學生聽到 Emma 的語音回應                                        │
└─────────────────────────────────────────────────────────────────┘
```

### FR-AGENT-05：教學狀態機（Teaching State Machine）

#### 狀態說明

| 狀態 | 進入條件 | Emma 行為風格 | 糾錯策略 |
|------|---------|--------------|---------|
| **WARMUP** | 初始（turn_count = 0） | 輕鬆、鼓勵、閒聊 | 最低限度，不打斷流暢度 |
| **PRACTICE** | turn_count ≥ 3 | 聚焦主題、追問、拉長回答 | 中等，糾正清楚且重覆的錯誤 |
| **CORRECTION** | LLM 呼叫 record_grammar_correction | 溫柔解釋 + 正確示範 | 只聚焦當次錯誤 |
| **SUMMARY** | turn_count ≥ 13 | 總結、讚美、建議、道別 | 不糾錯 |

#### 狀態轉移圖

```
         turn_count >= 3
WARMUP ─────────────────────► PRACTICE ─────── turn_count >= 13 ──► SUMMARY
                                  ▲                                    (End)
                                  │ exit_correction()
                              CORRECTION ◄── record_grammar_correction()
```

#### System Prompt 動態切換策略

TutorAgent 在每次狀態改變時執行：
```python
self.instructions = build_system_prompt(self.sm.state, self.sm.topic)
```

各狀態 Prompt 差異：
- **WARMUP**：強調輕鬆、鼓勵開口、不頻繁打斷
- **PRACTICE**：注入 `{topic}`，引導深度對話，適度糾正
- **CORRECTION**：聚焦解釋單一錯誤，語氣鼓勵
- **SUMMARY**：總結優點（2-3 點）、改善建議（1-2 點）、道別

### FR-AGENT-06：Function Tool — `record_grammar_correction`

**目的**：讓 LLM 在偵測到值得糾正的錯誤時，執行結構化的糾錯流程

**LLM 呼叫時機（應糾正）**：
- 影響溝通理解的文法錯誤
- 反覆出現（同一課程 ≥ 2 次）的錯誤
- 詞彙使用嚴重不當（如 boring vs bored）

**LLM 不呼叫時機（不糾正）**：
- 輕微口音問題
- 不影響理解的小錯誤（介系詞輕微誤用等）
- WARMUP 或 SUMMARY 階段

**參數**：

| 參數 | 型別 | 說明 |
|------|------|------|
| `original_text` | str | 學生說的錯誤句子或片語 |
| `corrected_text` | str | 正確版本 |
| `explanation` | str | 1-2 句鼓勵性解釋 |

**執行流程**：

```
record_grammar_correction(original, corrected, explanation)
  1. sm.record_correction()    → state = CORRECTION, correction_count++
  2. backend.post_correction() → 寫入 grammar_corrections 資料表
  3. room.publish_data(        → 即時推送前端
       topic="tutor.correction",
       payload={type, original, corrected, explanation}
     )
  4. sm.exit_correction()      → state = PRACTICE
  5. self.instructions = build_system_prompt(CORRECTION, topic)
  6. LLM 繼續語音說明這個錯誤
```

**推送到前端的 Data Channel Payload**：
```json
{
  "type": "correction",
  "original": "I am very boring in this meeting.",
  "corrected": "I am very bored in this meeting.",
  "explanation": "Use 'bored' to describe a feeling, not 'boring' which describes something that causes boredom."
}
```

### FR-AGENT-07：Function Tool — `advance_lesson_state`

**目的**：LLM 主動推進課程進度（可加速或手動跳過）

**觸發**：LLM 判斷當前階段目標已完成

**執行流程**：
```
advance_lesson_state()
  1. sm.advance()     → turn_count++ & 檢查狀態轉移
  2. self.instructions 更新
  3. room.publish_data(topic="tutor.state", payload={type, state})
```

**推送到前端的 Data Channel Payload**：
```json
{"type": "state_change", "state": "practice"}
```

### FR-AGENT-08：Function Tool — `get_lesson_state`

**目的**：讓 LLM 查詢當前進度，決定是否需要調整策略

**回傳範例**：
```
"State: practice, Turns: 7, Corrections made: 2"
```

### FR-AGENT-09：課程結束處理

| 觸發事件 | 處理 |
|---------|------|
| `session.on("close")` | `backend.notify_session_ended()` → `POST /internal/agent/session-ended` |
| 學生關閉瀏覽器 | LiveKit Cloud 偵測到 Participant 離開 → 觸發 close 事件 |
| 學生點 End Lesson | 後端直接設 ENDED；Agent 的 close 事件確保 double-check |

---

## 5. 課後報告生成模組

### FR-REPORT-01：報告生成觸發

- `POST /sessions/{id}/end` 執行後，立即建立 `BackgroundTask`
- 非同步執行，不阻塞 API 回應（學生立刻被導向 `/report/:id`）

### FR-REPORT-02：報告輸入資料

```python
# 從 DB 組合輸入
transcript = "\n".join(
    f"[{m.role.upper()}] {m.content}"
    for m in session.messages
)
corrections = [
    {"original_text": c.original_text,
     "corrected_text": c.corrected_text,
     "explanation": c.explanation}
    for c in session.corrections
]
```

### FR-REPORT-03：報告結構（Ollama 生成，繁體中文）

```markdown
## 課程摘要
（2-3 句話，說明本節課練習了什麼主題與對話內容）

## 表現亮點
（列出 2-3 個具體優點，例如：詞彙豐富、句子完整、回應流暢）

## 需要加強的地方
（列出 2-3 個改進建議，附上具體例句或說明）

## 本次新單字或句型
（從對話中萃取 3-5 個重要詞彙或句型，附簡短說明）

## 下次練習建議
（具體建議下次可以練習的方向、主題或表達方式）
```

### FR-REPORT-04：報告生成失敗處理

| 情境 | 行為 |
|------|------|
| Ollama 呼叫失敗（網路 / 模型錯誤） | 靜默失敗，不 crash；`report_text` 保持 null |
| 前端輪詢 | 永遠回傳 `{"status": "pending"}`（可未來加 timeout 機制） |
| 課程紀錄 | 對話記錄與糾錯紀錄不受影響 |

---

## 6. 前端模組

### FR-UI-01：登入頁面（`/login`）

**元件**：`LoginPage`（含 `LoginForm`）

| 元素 | 行為 |
|------|------|
| Login / Register 切換 | Toggle mode；Register 多顯示 `full_name` 欄位 |
| 表單送出（Register） | `POST /auth/register` → 成功後自動呼叫 login |
| 表單送出（Login） | `POST /auth/login` → JWT 存入 Zustand + localStorage |
| 登入成功 | Navigate to `/` |
| 登入失敗 | 顯示後端 `detail` 錯誤訊息（紅字） |
| 已登入使用者 | Router Guard 直接跳轉 `/` |

### FR-UI-02：儀表板（`/`）

**元件**：`DashboardPage`（含 `TopicSelector` + `SessionHistory`）

| 元素 | 行為 |
|------|------|
| 使用者資訊 | 顯示 email，右上角 Logout 按鈕 |
| Logout | 清除 Zustand store → Navigate to `/login` |
| 主題按鈕 × 5 | 點擊 → `POST /sessions/` → Navigate to `/lesson/{id}` |
| 建立中 Disabled | 課程建立期間按鈕 disabled |
| 歷史列表 | `GET /sessions/` → 顯示 topic / status / created_at |
| View Report 按鈕 | 只在 `status === "ended"` 時顯示 → Navigate to `/report/{id}` |

### FR-UI-03：課程頁面（`/lesson/:id`）

**元件**：`LessonPage` → `LiveKitRoom` → 子元件

#### 初始化流程

```
useEffect（mount）
  → getSessionToken(id)
  → 取得 {token, url}
  → 渲染 <LiveKitRoom token url connect audio>
  → Agent 自動加入 Room（LiveKit Cloud dispatch）
  → Emma 開口問候
```

#### 子元件規格

**`AgentStatus`**

| Agent State | 顯示文字 |
|------------|---------|
| `disconnected` | Waiting for tutor... |
| `connecting` | Connecting... |
| `initializing` | Initializing... |
| `listening` | Listening... |
| `thinking` | Thinking... |
| `speaking` | Emma is speaking... |

**`CorrectionPanel`**

- 累積顯示本課所有糾錯（不消失）
- 格式：`原文（紅色刪除線）` → `正確版本（綠色加粗）` + `說明（灰色小字）`
- 資料來源：`useAgentData()` hook 監聽 `tutor.correction` Data Channel topic

**`VoiceControls`**

- 靜音按鈕：`isMicrophoneEnabled` 決定顏色（紅 = 靜音中 / 綠 = 開啟）
- 呼叫 `localParticipant.setMicrophoneEnabled()`

**End Lesson 按鈕**

```
onClick → POST /sessions/{id}/end → Navigate to /report/{id}
```

#### Data Channel 即時事件

| Topic | 前端行為 |
|-------|---------|
| `tutor.correction` | 在 CorrectionPanel 新增一筆糾錯（append） |
| `tutor.state` | 更新 `lessonState` 狀態（可用於進度條顯示） |

### FR-UI-04：報告頁面（`/report/:id`）

**元件**：`ReportPage`（含 `SessionReport`）

| 狀態 | UI 顯示 |
|------|---------|
| loading（初始） | "Loading..." |
| pending | "Generating your report... 正在生成報告" |
| ready | 以 `white-space: pre-wrap` 渲染報告全文 |

- 輪詢間隔：每 **3 秒** 呼叫 `GET /sessions/{id}/report`
- 停止輪詢：`status === "ready"` 時清除 setTimeout

---

## 7. 資料模型規格

### 7.1 DB Schema

```sql
-- 使用者
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    full_name       VARCHAR,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 課程（一學生一節課）
CREATE TABLE tutor_sessions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) NOT NULL,
    room_name   VARCHAR UNIQUE NOT NULL,   -- "session-{id}"
    topic       VARCHAR NOT NULL,
    status      VARCHAR NOT NULL DEFAULT 'pending', -- pending|active|ended
    report_text TEXT,                      -- NULL 直到報告生成完成
    created_at  TIMESTAMP DEFAULT NOW(),
    ended_at    TIMESTAMP
);

-- 對話逐字稿
CREATE TABLE conversation_messages (
    id          SERIAL PRIMARY KEY,
    session_id  INTEGER REFERENCES tutor_sessions(id) ON DELETE CASCADE NOT NULL,
    role        VARCHAR NOT NULL,   -- "student" | "tutor"
    content     TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- 語法糾錯紀錄
CREATE TABLE grammar_corrections (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER REFERENCES tutor_sessions(id) ON DELETE CASCADE NOT NULL,
    original_text   TEXT NOT NULL,
    corrected_text  TEXT NOT NULL,
    explanation     TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

---

## 8. Agent-Backend 內部 API

> **僅供 LiveKit Agent Worker 呼叫**，前端不可直接使用。  
> 所有請求需帶 Header：`x-internal-secret: {INTERNAL_SECRET}`

### POST `/internal/agent/message`

```json
{
  "session_id": 42,
  "role": "student",       // "student" | "tutor"
  "content": "I am very boring today."
}
```

**回應**：`{"ok": true}`

### POST `/internal/agent/correction`

```json
{
  "session_id": 42,
  "original_text": "I am very boring today.",
  "corrected_text": "I am very bored today.",
  "explanation": "Use 'bored' (feeling) not 'boring' (causing boredom)."
}
```

**回應**：`{"ok": true}`

### POST `/internal/agent/session-ended?session_id=42`

**回應**：`{"ok": true}`  
**行為**：若 Session.status ≠ ENDED，更新為 ENDED + 記錄 ended_at

---

## 9. 完整系統事件流程

```
[學生] 開啟 Dashboard
  → 點擊主題（e.g. "Job Interview English"）
  → POST /sessions/ → status=PENDING，room_name="session-42"
  → Navigate to /lesson/42

[LessonPage 初始化]
  → POST /sessions/42/token → status=ACTIVE，取得 LiveKit token
  → <LiveKitRoom> 連線 wss://xxx.livekit.cloud，Room: "session-42"

[Emma Agent]
  → LiveKit Cloud dispatch → Agent Worker 收到 Room "session-42"
  → ctx.connect() 加入 Room
  → 初始化 AgentSession（VAD + STT + LLM + TTS）
  → session.generate_reply("Greet warmly...") → Emma 說開場白

══════════════════════ 對話循環 ══════════════════════

[每輪對話]
  學生說話 → VAD → Deepgram STT → transcript
  sm.advance() → turn_count++ / 檢查狀態
  backend.post_message(role="student")

  LLM 思考 →
    [若偵測錯誤]
      record_grammar_correction(original, corrected, explanation)
      → backend.post_correction() → DB
      → room.publish_data(topic="tutor.correction") → 前端即時顯示
    [若需推進]
      advance_lesson_state()
      → 更新 instructions + publish state_change

  Emma TTS 回應 → backend.post_message(role="tutor")

══════════════════════ 課程結束 ══════════════════════

[turn_count >= 13 → SUMMARY]
  Emma 總結 → 道別 → Room 關閉
  Agent on_close → backend.notify_session_ended()

[學生點 End Lesson]
  POST /sessions/42/end → status=ENDED
  BackgroundTask: generate_session_report(transcript, corrections)
    → Ollama → 繁體中文報告 → session.report_text
  Navigate to /report/42

[ReportPage]
  每 3s: GET /sessions/42/report
  → {"status": "ready", "report": "..."} → 顯示報告
```

---

## 10. 錯誤處理規格

| 情境 | 處理方式 | 影響範圍 |
|------|---------|---------|
| STT 無法辨識（靜音 / 雜音） | Silero VAD 過濾，不觸發 LLM | 無 |
| LLM 回應超時（> 30s） | LiveKit Agent SDK 內部重試 | 延遲一輪對話 |
| BackendClient HTTP 呼叫失敗 | 靜默 try/except，log warning | 該訊息不持久化 |
| 報告生成失敗（Ollama 錯誤） | report_text 保持 null | 僅報告缺失 |
| 學生直接關閉瀏覽器 | LiveKit on_disconnect → Agent on_close | Agent 呼叫 session-ended |
| JWT 過期（24h 後） | 401 → 前端清除 Token → Navigate `/login` | 需重新登入 |
| 存取他人課程 | 403 Forbidden | 無資料洩漏 |
| Agent 意外崩潰 | LiveKit Cloud 重新 dispatch 到可用 Worker | 課程短暫中斷 |
| PostgreSQL 連線失敗 | FastAPI startup 失敗，不啟動 | 整個服務不可用 |
| Deepgram 連線失敗 | Agent STT 初始化失敗，log error | 該 Room 無法開始對話 |

---

## 11. 待定事項（Open Questions）

| # | 問題 | 影響範圍 | 優先 |
|---|------|---------|------|
| 1 | `qwen3.5:35b` 端對端延遲實測是否 ≤ 5s？ | Agent 回應速度體驗 | 高 |
| 2 | Cartesia TTS 要使用哪個 voice ID（英文女聲）？ | 聽覺體驗 | 高 |
| 3 | 課程輪數（13 輪）是否固定或讓使用者設定？ | UX + State Machine | 中 |
| 4 | 報告頁面要 Markdown render 還是純文字？ | ReportPage UI | 中 |
| 5 | 要不要加 `GET /auth/me` endpoint？ | 前端 user profile 完整性 | 低 |
| 6 | Room metadata 怎麼從前端傳給 Agent？（目前用 room.metadata） | Agent topic 取得 | 高 |
| 7 | 同一學生能否同時開兩個課程（雙 Room）？ | Session 並發控制 | 中 |

---

## 12. API 端點總覽

### Public API

| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/auth/register` | 使用者註冊 |
| POST | `/auth/login` | 使用者登入（回傳 JWT） |

### Protected API（需 JWT Bearer Token）

| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/sessions/` | 建立新課程 |
| GET | `/sessions/` | 列出我的所有課程 |
| GET | `/sessions/{id}` | 取得單一課程詳情 |
| POST | `/sessions/{id}/token` | 取得 LiveKit token |
| POST | `/sessions/{id}/end` | 結束課程（觸發報告生成） |
| GET | `/sessions/{id}/report` | 查詢課後報告（輪詢） |
| GET | `/sessions/{id}/messages` | 取得課程對話記錄 |

### Internal API（需 x-internal-secret Header）

| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/internal/agent/message` | Agent 持久化對話訊息 |
| POST | `/internal/agent/correction` | Agent 持久化語法糾錯 |
| POST | `/internal/agent/session-ended` | Agent 通知課程結束 |
