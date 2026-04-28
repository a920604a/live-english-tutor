# FRD — 功能需求文件（Functional Requirements Document）

**產品**：Live English Tutor  
**版本**：v0.2  
**日期**：2026-04-16  
**依據**：PRD v0.2

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
│     - 選配：發布攝影機視訊（video track）
│     - 選配：發布螢幕分享（screen share track）
│     - 接收 Data Channel（糾錯 / 狀態 / 字幕事件）
│
└── Participant 2: Emma Agent        （AI 老師）
      - 訂閱學生音訊 + 視訊（Gemini Realtime 處理）
      - 發布 TTS 語音
      - 發布 Data Channel 事件
```

- Room 名稱格式：`session-{session_id}`
- 學生透過 `POST /sessions/{id}/token` 取得 LiveKit token 後加入
- Backend 呼叫 LiveKit API 預建 Room 並 dispatch Agent Worker
- 第三方不得加入同一 Room（token 限制最多 2 位 participant）

---

## 2. 身分驗證模組

### FR-AUTH-01：Firebase Token 驗證

| 項目 | 規格 |
|------|------|
| **端點** | `POST /auth/verify` |
| **輸入** | `{id_token: string}`（Firebase ID Token，由前端 Google Sign-In 取得） |
| **處理** | Firebase Admin SDK `verify_id_token()` → upsert User（依 firebase_uid / email） |
| **輸出** | `{id, email, full_name}` |
| **HTTP** | 200 OK / 401 Unauthorized |

**Upsert 邏輯**：
1. 以 `firebase_uid` 查找 → 找到則回傳
2. 以 `email` 查找 → 找到則補寫 `firebase_uid`（舊帳號遷移）
3. 都找不到 → 建立新 User

### FR-AUTH-02：API 請求驗證

- 所有 `/sessions/*` 路由需帶 `Authorization: Bearer <firebase_id_token>`
- Middleware 呼叫 Firebase Admin SDK 驗證 token → 取得 user
- Token 無效或過期 → **401 Unauthorized**

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
PENDING → ACTIVE（學生取得 Token 時）→ ENDED（學生點 End / Agent 通知）
```

### FR-SESSION-02：取得 LiveKit Token

| 項目 | 規格 |
|------|------|
| **端點** | `POST /sessions/{id}/token` |
| **觸發** | LessonPage `useEffect` 初始化時（React StrictMode 可能觸發兩次，已有 double-dispatch 防護） |
| **驗證** | Session 歸屬當前使用者；status ≠ ENDED |
| **處理** | Session.status → ACTIVE；呼叫 `ensure_room_and_dispatch()`；生成 LiveKit AccessToken |
| **Token Grants** | `room_join=True, can_publish=True, can_subscribe=True` |
| **Token Identity** | `user-{user_id}` |
| **輸出** | `{token: string, url: string}` |
| **HTTP** | 200 OK |

**`ensure_room_and_dispatch()` 流程**：
1. `LiveKitAPI.room.create_room(name)` — 冪等，已存在也不報錯
2. `list_dispatch(room_name)` — 若已有 dispatch 則跳過（防止重複）
3. `create_dispatch(room_name, agent_name="")` — dispatch agent worker

### FR-SESSION-03：結束課程

| 項目 | 規格 |
|------|------|
| **端點** | `POST /sessions/{id}/end` |
| **觸發** | 學生點擊「End Lesson」按鈕 |
| **處理** | status → ENDED；ended_at = NOW()；若 `ENABLE_REPORT_GENERATION=true` 則觸發 BackgroundTask |
| **輸出** | SessionOut（含 ended_at） |
| **HTTP** | 200 OK |

### FR-SESSION-04：查詢課後報告

| 項目 | 規格 |
|------|------|
| **端點** | `GET /sessions/{id}/report` |
| **輸出（disabled）** | `{"status": "disabled", "report": null}`（`ENABLE_REPORT_GENERATION=false`） |
| **輸出（pending）** | `{"status": "pending", "report": null}` |
| **輸出（ready）** | `{"status": "ready", "report": "<Markdown 文字>"}` |
| **前端行為** | `disabled` → 立即顯示「不提供報告」；`pending` → 每 3 秒輪詢（最多 40 次）；`ready` → 顯示內容 |

### FR-SESSION-05：列出歷史課程

| 項目 | 規格 |
|------|------|
| **端點** | `GET /sessions/` |
| **排序** | created_at DESC |
| **回傳** | `List[SessionOut]`（僅當前使用者的課程） |

---

## 4. AI 老師（Emma Agent）模組

### FR-AGENT-01：Agent Worker 啟動

```bash
python -m agent.main start
```

Agent Worker 持續連線 LiveKit Server，監聽 dispatch 事件。
收到 dispatch 後呼叫 `entrypoint(ctx: JobContext)`。

### FR-AGENT-02：Entrypoint 初始化流程

```
entrypoint(ctx: JobContext)
  1. await ctx.connect()
  2. session_id = parse("session-{N}" → N)
  3. topic = ctx.room.metadata or "general conversation"
  4. backend = BackendClient(session_id)
  5. agent = TutorAgent(session_id, backend, topic)
  6. session = AgentSession(
         llm=google.beta.realtime.RealtimeModel(
             model="gemini-2.5-flash-native-audio-preview-12-2025"
         )
     )
  7. session.start(
         agent=agent,
         room=ctx.room,
         room_input_options=RoomInputOptions(video_enabled=True)
     )
  8. session.generate_reply(greeting_instructions)
```

> **Gemini Realtime** 原生處理 VAD + STT + LLM + TTS，不需要個別 Deepgram / Cartesia / Silero 服務。

### FR-AGENT-03：Emma 開場白

**觸發**：`session.generate_reply()` 在 Agent 加入後立即執行

**Instruction 樣板**：
> "Greet {student_name} warmly, introduce yourself as Emma, and begin with a friendly warm-up question related to {topic}. Remind the student to press the microphone button to speak."

### FR-AGENT-04：語音對話流程（每輪）

```
學生說話（麥克風）
  ↓ Gemini Realtime 偵測語音結束（內建 VAD）
  ↓ Gemini 轉文字（內建 STT）
  [user_input_transcribed event, is_final=True]
  ↓
  1. backend.post_message(role="student")  → 持久化
  2. publish_data(topic="tutor.transcript.user") → 前端字幕
  ↓
  Gemini Realtime LLM 推理
  ↓（可能呼叫 function tools：record_correction / advance / get_state）
  [agent_speech_committed event]
  ↓
  3. backend.post_message(role="tutor") → 持久化
  ↓ Gemini Realtime TTS 合成語音（內建）
  學生聽到 Emma 的語音回應
  （agentTranscriptions 事件推送到前端字幕）
```

### FR-AGENT-05：教學狀態機（Teaching State Machine）

| 狀態 | 進入條件 | Emma 行為風格 | 糾錯策略 |
|------|---------|--------------|---------|
| **WARMUP** | 初始（turn_count = 0） | 輕鬆、鼓勵、閒聊 | 最低限度 |
| **PRACTICE** | turn_count ≥ 3 | 聚焦主題、追問 | 中等，糾正明顯錯誤 |
| **CORRECTION** | LLM 呼叫 record_grammar_correction | 溫柔解釋 + 正確示範 | 聚焦當次錯誤 |
| **SUMMARY** | turn_count ≥ 13 | 總結、讚美、建議、道別 | 不糾錯 |

```
         turn_count >= 3
WARMUP ──────────────────► PRACTICE ──── turn_count >= 13 ──► SUMMARY
                               ▲
                               │ exit_correction()
                           CORRECTION ◄── record_grammar_correction()
```

### FR-AGENT-06：Function Tool — `record_grammar_correction`

**參數**：

| 參數 | 型別 | 說明 |
|------|------|------|
| `original_text` | str | 學生說的錯誤句子或片語 |
| `corrected_text` | str | 正確版本 |
| `explanation` | str | 1-2 句鼓勵性解釋 |

**執行流程**：
1. `sm.record_correction()` → state = CORRECTION
2. `backend.post_correction()` → 寫入 DB
3. `publish_data(topic="tutor.correction")` → 前端即時顯示
4. `sm.exit_correction()` → state = PRACTICE
5. 更新 `self.instructions`

### FR-AGENT-07：Function Tool — `advance_lesson_state`

觸發 `sm.advance()`，更新 instructions，`publish_data(topic="tutor.state")`。

### FR-AGENT-08：Function Tool — `get_lesson_state`

回傳 `"State: {state}, Turns: {n}, Corrections made: {n}"`。

### FR-AGENT-09：課程結束處理

| 觸發事件 | 處理 |
|---------|------|
| `session.on("close")` | `backend.notify_session_ended()` |
| Job shutdown callback | `backend.notify_session_ended()`（fallback） |
| 學生關閉瀏覽器 | LiveKit departure_timeout (30s) → Room 關閉 → Agent close 事件 |

---

## 5. 課後報告生成模組

### FR-REPORT-01：報告生成觸發

- `POST /sessions/{id}/end` 且 `ENABLE_REPORT_GENERATION=true` 時建立 BackgroundTask
- 非同步執行，不阻塞 API 回應

### FR-REPORT-02：報告輸入資料

```python
transcript = "\n".join(f"[{m.role.upper()}] {m.content}" for m in session.messages)
corrections = [{"original_text": ..., "corrected_text": ..., "explanation": ...}
               for c in session.corrections]
```

### FR-REPORT-03：報告生成

**模型**：Ollama（`OLLAMA_BASE_URL` / `OLLAMA_MODEL`，OpenAI 相容 API）  
**語言**：繁體中文  
**結構**：
1. 課程摘要（2-3 句）
2. 表現亮點（2-3 點）
3. 需要加強的地方（2-3 點）
4. 本次新單字或句型
5. 下次練習建議

### FR-REPORT-04：報告生成失敗處理

| 情境 | 行為 |
|------|------|
| `ENABLE_REPORT_GENERATION=false` | 跳過生成；`GET /report` 立即回傳 `"disabled"` |
| Ollama 呼叫失敗 | 靜默失敗，`report_text` 保持 null，`GET /report` 回傳 `"pending"` |
| 前端輪詢超過 40 次（~2 分鐘） | 顯示「No report available」 |

---

## 6. 前端模組

### FR-UI-01：登入頁面（`/login`）

| 元素 | 行為 |
|------|------|
| Google Sign-In 按鈕 | 觸發 Firebase `signInWithPopup(GoogleAuthProvider)` |
| 登入成功 | Firebase ID Token → `POST /auth/verify` → JWT 存入 Zustand + localStorage → Navigate `/` |
| 已登入使用者 | Router Guard 直接跳轉 `/` |

### FR-UI-02：儀表板（`/`）

| 元素 | 行為 |
|------|------|
| 使用者資訊 | 顯示 email，右上角 Logout 按鈕 |
| Logout | 清除 Zustand store → Navigate `/login` |
| 主題按鈕 × 5 | 點擊 → `POST /sessions/` → Navigate `/lesson/{id}` |
| 歷史列表 | `GET /sessions/` → 顯示 topic / status / created_at |
| View Report 按鈕 | 只在 `status === "ended"` 時顯示 → Navigate `/report/{id}` |

### FR-UI-03：課程頁面（`/lesson/:id`）

**元件結構**：

```
LessonPage
├── Header（Emma logo + End Lesson 按鈕）
├── ToolBar（攝影機 / 螢幕分享 / 字幕 開關）
├── MainStage
│   ├── VideoGrid（攝影機 + 螢幕分享，有視訊時顯示）
│   └── EmmaAvatar + AgentStatus（無視訊時顯示）
├── CaptionPanel（字幕開啟時顯示）
├── VoiceControls（麥克風 Toggle）
└── CorrectionPanel
```

#### 初始化流程

```
useEffect（mount）
  → POST /sessions/{id}/token
  → 取得 {token, url}
  → <LiveKitRoom token url connect audio>
  → Agent 自動加入 Room
  → Emma 開口問候
```

#### ToolBar

| 按鈕 | 動作 | Active 狀態 |
|------|------|-----------|
| 🎥 Camera | `localParticipant.setCameraEnabled(toggle)` | indigo 底色 |
| 🖥 Screen | `localParticipant.setScreenShareEnabled(toggle)` | indigo 底色 |
| 💬 Captions | 切換 `captionsEnabled` state | indigo 底色 |

#### VideoGrid

| 情況 | 顯示 |
|------|------|
| 無視訊 | EmmaAvatar |
| 只有攝影機 or 螢幕分享 | 單一全幅 `<VideoTrack>` |
| 兩者都開 | 螢幕分享（大）+ 攝影機（右上角小視窗） |

#### CaptionPanel

- 對話泡泡列表，可捲動，自動捲到最新
- User 訊息：右對齊，slate 泡泡
- Agent 訊息：左對齊，indigo 泡泡
- 資料來源：`agentTranscriptions`（useVoiceAssistant）+ `tutor.transcript.user`（Data Channel）
- 最多保留 50 筆，超過刪最舊
- 預設**關閉**

#### VoiceControls（Toggle 模式）

| 狀態 | 顏色 | 圖示 | 文字 |
|------|------|------|------|
| 關閉 | slate-200 | 🔇 | "Tap to speak" |
| 開啟 | rose-500 + pulse ring | 🎙️ | "Tap to stop" |

`onClick` 切換 `localParticipant.setMicrophoneEnabled()`。

#### AgentStatus

| Agent State | 顯示文字 |
|------------|---------|
| `disconnected` | Waiting for tutor… |
| `connecting` | Connecting… |
| `initializing` | Initializing… |
| `listening` | Listening… |
| `thinking` | Emma is thinking… |
| `speaking` | Emma is speaking… |

#### CorrectionPanel

- 累積顯示本課所有糾錯
- 格式：`原文（紅色刪除線）→ 正確版本（綠色）+ 說明（灰色小字）`
- 資料來源：`tutor.correction` Data Channel

#### Data Channel Topics

| Topic | 方向 | 前端行為 |
|-------|------|---------|
| `tutor.correction` | Agent → 前端 | CorrectionPanel 新增一筆 |
| `tutor.state` | Agent → 前端 | 更新 lessonState |
| `tutor.transcript.user` | Agent → 前端 | CaptionPanel 新增 user 訊息 |

### FR-UI-04：報告頁面（`/report/:id`）

| 狀態 | UI 顯示 |
|------|---------|
| loading | 旋轉動畫 |
| pending | "Generating your report…" + 跳點動畫 |
| ready | 報告全文（`white-space: pre-wrap`） |
| unavailable | "No report available" + Back to Dashboard |
| error | "Could not load report" + Back to Dashboard |

- `disabled` 回應 → 立即進入 `unavailable`（不輪詢）
- `pending` → 每 3 秒輪詢，最多 40 次後進入 `unavailable`

---

## 7. 資料模型規格

### 7.1 DB Schema

```sql
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    firebase_uid    VARCHAR UNIQUE,
    email           VARCHAR UNIQUE NOT NULL,
    full_name       VARCHAR,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tutor_sessions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) NOT NULL,
    room_name   VARCHAR UNIQUE NOT NULL,
    topic       VARCHAR NOT NULL,
    status      VARCHAR NOT NULL DEFAULT 'pending',
    report_text TEXT,
    created_at  TIMESTAMP DEFAULT NOW(),
    ended_at    TIMESTAMP
);

CREATE TABLE conversation_messages (
    id          SERIAL PRIMARY KEY,
    session_id  INTEGER REFERENCES tutor_sessions(id) ON DELETE CASCADE NOT NULL,
    role        VARCHAR NOT NULL,   -- "student" | "tutor"
    content     TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

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

> 僅供 LiveKit Agent Worker 呼叫，需帶 Header：`x-internal-secret: {INTERNAL_SECRET}`

| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/internal/agent/message` | 持久化對話訊息 `{session_id, role, content}` |
| POST | `/internal/agent/correction` | 持久化語法糾錯 `{session_id, original_text, corrected_text, explanation}` |
| POST | `/internal/agent/session-ended?session_id={id}` | 通知課程結束 |

---

## 9. 完整系統事件流程

```
[學生] Dashboard → 選擇主題
  → POST /sessions/ → status=PENDING, room="session-42"
  → Navigate /lesson/42

[LessonPage]
  → POST /sessions/42/token
    → ensure_room_and_dispatch("session-42")  ← 建立 Room + dispatch Agent
    → status=ACTIVE, 回傳 token
  → <LiveKitRoom> 連線

[Emma Agent]
  → 收到 dispatch → ctx.connect()
  → AgentSession(Gemini Realtime).start(video_enabled=True)
  → generate_reply(greeting) → Emma 說開場白

══ 對話循環 ══

[每輪]
  學生說 → Gemini VAD+STT → transcript
  backend.post_message("student")
  publish_data("tutor.transcript.user") → 前端字幕

  Gemini LLM 推理 →
    [若偵測錯誤] record_grammar_correction()
      → backend.post_correction()
      → publish_data("tutor.correction") → CorrectionPanel
    [若需推進] advance_lesson_state()
      → publish_data("tutor.state")

  Gemini TTS 回應 → backend.post_message("tutor")
  agentTranscriptions 事件 → 前端字幕

══ 課程結束 ══

[SUMMARY 完成 / 學生點 End Lesson]
  POST /sessions/42/end → status=ENDED
  BackgroundTask: Ollama 生成繁體中文報告
  Navigate /report/42

[ReportPage]
  GET /sessions/42/report
  → disabled: 立即顯示「不提供報告」
  → pending: 每 3s 輪詢
  → ready: 顯示報告
```

---

## 10. 錯誤處理規格

| 情境 | 處理方式 |
|------|---------|
| Gemini Realtime 連線失敗 | Agent 重試（SDK 內建 max_retry=3） |
| BackendClient HTTP 失敗 | 靜默 try/except，log warning |
| 報告生成失敗（Ollama 錯誤） | report_text 保持 null，前端輪詢 timeout 後顯示 unavailable |
| 學生關閉瀏覽器 | departure_timeout 30s → Room 關閉 → Agent on_close → session-ended |
| Firebase Token 無效 | 401 → 前端清除 Token → Navigate `/login` |
| 存取他人課程 | 403 Forbidden |
| Agent double-dispatch | list_dispatch() 防護，重複呼叫 token endpoint 不會雙重啟動 Agent |
| PostgreSQL 連線失敗 | FastAPI startup 失敗 |

---

## 11. API 端點總覽

### Protected API（需 Firebase ID Token）

| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/auth/verify` | Firebase token 驗證 + upsert user |
| POST | `/sessions/` | 建立新課程 |
| GET | `/sessions/` | 列出我的所有課程 |
| GET | `/sessions/{id}` | 取得單一課程詳情 |
| POST | `/sessions/{id}/token` | 取得 LiveKit token（同時建立 Room + dispatch Agent） |
| POST | `/sessions/{id}/end` | 結束課程 |
| GET | `/sessions/{id}/report` | 查詢課後報告 |
| GET | `/sessions/{id}/messages` | 取得對話紀錄 |

### Internal API（需 `x-internal-secret` Header）

| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/internal/agent/message` | 持久化對話訊息 |
| POST | `/internal/agent/correction` | 持久化語法糾錯 |
| POST | `/internal/agent/session-ended` | 通知課程結束 |
