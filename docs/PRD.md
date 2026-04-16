# PRD — 產品需求文件（Product Requirements Document）

**產品**：Live English Tutor  
**版本**：v0.2  
**日期**：2026-04-16  
**狀態**：進行中

---

## 1. 產品概述

### 1.1 產品名稱
**Live English Tutor**

### 1.2 產品定位
一套以即時語音為核心的 AI 英文家教系統。學生透過麥克風（與選配攝影機 / 螢幕分享）與 AI 老師（Emma）進行真人感對話練習，系統即時糾錯、生成課後報告。

### 1.3 核心主張（Value Proposition）

| 痛點 | 傳統解法的不足 | 本產品解法 |
|------|--------------|-----------|
| 開口練習機會少 | 找真人老師貴且排程困難 | 24h 可用的 AI 語音家教 |
| 不敢開口怕出糗 | 真人互動有心理壓力 | AI 老師永不批判，隨時重來 |
| 糾錯不即時 | 事後批改太晚，印象淡 | 對話中即時標注錯誤 |
| 無系統學習歷程 | 每次練習缺乏追蹤 | 每次課程生成結構化報告 |
| 補習貴 | 一對一家教時薪高 | 低成本 SaaS 訂閱 |

---

## 2. 使用者輪廓（User Personas）

### Persona A：職場轉型者（主力客群）
- **年齡**：25–40 歲
- **背景**：有工作經驗，英文閱讀尚可，但口說信心不足
- **動機**：準備外商面試、出國開會、提升職場競爭力
- **使用行為**：下班後 20–40 分鐘練習，偏好即時糾正

### Persona B：學生族群
- **年齡**：18–25 歲
- **背景**：大學生 / 研究生，準備雅思 / 托福口說或海外交流
- **動機**：累積口說自信，不想花大錢補習
- **使用行為**：通學途中 / 課後自習，每週 3–5 次

### Persona C：語言愛好者
- **年齡**：30–55 歲
- **背景**：英文程度中等，想維持口說流利度
- **動機**：退休或旅遊前維持英語能力
- **使用行為**：彈性時間，主要練生活英語

---

## 3. 使用者目標

1. **開口練習**：能和 AI 老師進行自然的英文對話，不怕說錯
2. **即時知道自己哪裡錯**：對話途中看到糾正，當下理解
3. **有結構的學習**：每節課有主題，學完有摘要報告
4. **追蹤進步**：能回顧歷史課程，看到自己的進步軌跡

---

## 4. 產品目標（Product Goals）

### Phase 1 — MVP（目前）
- ✅ 使用者可以用語音和 AI 老師對話（Gemini Realtime 原生音訊）
- ✅ AI 老師依課程主題引導對話
- ✅ 即時顯示語法糾正
- ✅ 課後生成結構化學習報告
- ✅ 保存所有課程紀錄
- 🔄 字幕面板（對話泡泡，可開關）
- 🔄 麥克風 Toggle 模式（取代 hold-to-speak）
- 🔄 攝影機 + 螢幕分享（Emma 可看見畫面）

### Phase 2 — Enhancement
- 多語言介面（繁中 / 英文）
- 發音評分（phoneme-level feedback）
- 單字本（從課程中自動收集生字）
- 學習進度儀表板（圖表）
- 噪音消除（noise cancellation plugin）

### Phase 3 — Scale
- Android / iOS App
- 付費方案（訂閱制）
- 多老師角色（正式 / 輕鬆 / 嚴格）
- 企業版（公司英語訓練）

---

## 5. 高層功能清單（Feature List）

| 功能類別 | 功能項目 | MVP | Phase 2 |
|---------|---------|:---:|:-------:|
| 身分驗證 | Google Sign-In（Firebase Auth） | ✅ | |
| 課程管理 | 選擇課程主題 | ✅ | |
| 即時語音 | AI 老師語音對話 | ✅ | |
| 字幕 | 對話逐字幕（可開關） | 🔄 | |
| 麥克風 | Toggle 開關模式 | 🔄 | |
| 視訊 | 攝影機 + 螢幕分享（Emma 可接收） | 🔄 | |
| 教學引導 | 分階段教學流程 | ✅ | |
| 糾錯 | 即時語法糾正顯示 | ✅ | |
| 課後報告 | AI 生成學習報告 | ✅ | |
| 學習紀錄 | 課程歷史列表 | ✅ | |
| 發音 | 發音評分 | | ✅ |
| 單字本 | 自動萃取生字 | | ✅ |
| 進度圖表 | 學習曲線視覺化 | | ✅ |

---

## 6. 支援課程主題（MVP）

| 主題 | 說明 | 適合對象 |
|------|------|---------|
| General Conversation | 日常閒聊、話題討論 | 所有人 |
| Job Interview English | 面試問答、STAR 問題、自我介紹 | 求職者 |
| Travel English | 機場、飯店、餐廳、問路 | 旅遊備考 |
| Business English | 會議英語、Email 討論、簡報 | 職場人士 |
| Daily Life English | 購物、看診、日常服務 | 生活英語 |

---

## 7. 非功能性需求（Non-Functional Requirements）

### 7.1 效能

| 指標 | 目標 |
|------|------|
| 端對端對話延遲（說完→聽到回應） | ≤ 3s（目標）/ 5s（可接受） |
| 課後報告生成時間 | ≤ 60s（Ollama） |
| LiveKit 房間建立延遲 | ≤ 2s |

> 使用 Gemini Realtime 原生音訊模型，STT / LLM / TTS 合一，不再有個別服務延遲需考量。

### 7.2 可靠性
- Agent 斷線自動重連（LiveKit Agent SDK 管理）
- 課程訊息即時持久化（非批次寫入）
- 報告生成失敗不影響課程紀錄

### 7.3 安全性
- Firebase ID Token 驗證（Firebase Admin SDK server-side verify）
- Agent→Backend 使用 Internal Secret Header 隔離內部呼叫
- 使用者只能存取自己的課程資料（ownership check）

### 7.4 擴展性
- 無狀態 FastAPI，可水平擴展
- Agent Worker 可多個並行（LiveKit 自動分配 room）
- 資料庫使用 PostgreSQL，支援 Connection Pooling

---

## 8. 成功指標（KPIs）

| 指標 | 目標（3 個月後） |
|------|--------------|
| 每週活躍用戶（WAU） | ≥ 100 |
| 平均課程時長 | ≥ 15 分鐘 |
| 課程完成率（到 SUMMARY 階段） | ≥ 60% |
| 報告生成成功率 | ≥ 95% |
| 用戶 7 日留存率 | ≥ 30% |

---

## 9. 範圍外（Out of Scope — 目前）

- 多位學生同一房間
- 真人老師接入
- 課程付費 / 訂閱系統
- 推播通知 / Email 提醒
- 行動 App（Android / iOS）
- 多語言介面

---

## 10. 技術選型（Tech Stack）

| 層次 | 技術 |
|------|------|
| Frontend | React 18 + TypeScript + Vite + Zustand + Axios |
| Real-time | LiveKit（Self-hosted）+ @livekit/components-react |
| Backend | FastAPI + SQLAlchemy 2.0 + PostgreSQL 16 |
| AI Agent | LiveKit Agents SDK 1.x（Python） |
| 語音模型 | Google Gemini 2.5 Flash Native Audio（STT + LLM + TTS 一體） |
| 報告生成 | Ollama（外部伺服器，OpenAI 相容 API） |
| 認證 | Firebase Authentication（Google Sign-In） |
| 部署 | Docker Compose（後端）、Cloudflare Pages（前端） |
