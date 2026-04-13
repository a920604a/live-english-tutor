# System Architecture

> Live English Tutor — Technical Architecture Reference

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture Diagram](#2-high-level-architecture-diagram)
3. [Module Breakdown](#3-module-breakdown)
4. [Data Flow Pipelines](#4-data-flow-pipelines)
5. [Database Schema](#5-database-schema)
6. [Authentication Flow](#6-authentication-flow)
7. [Agent State Machine](#7-agent-state-machine)
8. [Deployment Topology](#8-deployment-topology)

---

## 1. System Overview

Live English Tutor is a real-time AI voice tutoring system. Users speak with an AI agent named Emma over WebRTC audio. The system has three runtime services plus an external Ollama LLM server.

**Core technologies:**

| Layer | Stack |
|-------|-------|
| Frontend | React 18 + TypeScript, Tailwind CSS v4, LiveKit JS SDK, Firebase SDK |
| Backend | FastAPI + SQLAlchemy 2.0, PostgreSQL 16 |
| Agent | LiveKit Agents SDK 1.0 (Python), Ollama (local LLM) |
| Auth | Firebase Authentication (Google Sign-In) |
| Real-time | LiveKit Cloud (WebRTC audio + data channel) |
| LLM | Ollama — self-hosted, OpenAI-compatible API |

---

## 2. High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        User's Browser                                 │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                   React Frontend                                │  │
│  │                                                                 │  │
│  │  LoginPage  DashboardPage  LessonPage  ReportPage               │  │
│  │       │           │            │            │                   │  │
│  │  Firebase     Axios/REST    LiveKit      Axios/REST             │  │
│  │   SDK            │          JS SDK          │                   │  │
│  └──────┬───────────┼────────────┬─────────────┼───────────────────┘  │
│         │           │            │             │                       │
└─────────┼───────────┼────────────┼─────────────┼───────────────────────┘
          │           │            │             │
          ▼           ▼            │             ▼
   ┌────────────┐  ┌──────────────┐│  ┌──────────────────────┐
   │  Firebase  │  │   FastAPI    ││  │   FastAPI (Backend)  │
   │   Auth     │  │  Backend     ││  │  /sessions/{id}/     │
   │  (Google)  │  │  /auth/      ││  │  report              │
   └────────────┘  │  /sessions/  ││  └──────────────────────┘
                   │  /internal/  ││            │
                   └──────┬───────┘│            ▼
                          │        │    ┌───────────────┐
                          ▼        │    │   Ollama LLM  │
                   ┌────────────┐  │    │ (192.168.x.x) │
                   │ PostgreSQL │  │    └───────────────┘
                   │  (Docker)  │  │
                   └────────────┘  │
                                   ▼
                          ┌─────────────────┐
                          │  LiveKit Cloud  │◄──── WebRTC Audio
                          │  (Room Server)  │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  LiveKit Agent  │
                          │   (Python)      │
                          │  TutorAgent     │
                          │  StateMachine   │
                          └────────┬────────┘
                                   │ HTTP
                                   ▼
                          ┌─────────────────┐
                          │   FastAPI       │
                          │  /internal/     │
                          │  (agent calls)  │
                          └─────────────────┘
```

---

## 3. Module Breakdown

### 3-1 Frontend Modules

```
frontend-web/src/
│
├── firebase.ts                ← Firebase client SDK init (auth, googleProvider)
│
├── App.tsx                    ← Root: onAuthStateChanged gate, syncs Firebase
│                                user → backend, populates Zustand store
│
├── router.tsx                 ← React Router v6
│                                  /login          → LoginPage
│                                  /               → DashboardPage  [RequireAuth]
│                                  /lesson/:id     → LessonPage     [RequireAuth]
│                                  /report/:id     → ReportPage     [RequireAuth]
│                                  *               → redirect /
│
├── store/
│   └── authStore.ts           ← Zustand: { user: AppUser | null, setUser }
│                                Not persisted; re-hydrated on page load
│
├── api/
│   ├── client.ts              ← Axios instance
│   │                              baseURL: VITE_API_BASE_URL ?? "" (Vite proxy in dev)
│   │                              interceptor: auto-attach Firebase ID token
│   ├── auth.ts                ← POST /auth/verify → AppUser
│   └── sessions.ts            ← CRUD: createSession, getSessions, getSessionToken,
│                                        endSession, getReport
│
├── hooks/
│   └── useAgentData.ts        ← Subscribes to LiveKit data channel
│                                  topic "tutor.correction" → corrections[]
│                                  topic "tutor.state"      → lessonState
│
└── pages/ + components/
    ├── LoginPage.tsx           ← Google Sign-In → Firebase → backend verify
    ├── DashboardPage.tsx       ← Topic selector + session history
    ├── LessonPage.tsx          ← LiveKitRoom wrapper + lesson UI
    │   ├── AgentStatus.tsx     ← useVoiceAssistant().state → colored dot + label
    │   ├── VoiceControls.tsx   ← useLocalParticipant() → mic toggle button
    │   └── CorrectionPanel.tsx ← useAgentData().corrections → correction cards
    └── ReportPage.tsx          ← Poll GET /sessions/{id}/report until ready
```

### 3-2 Backend Modules

```
backend-fastapi/app/
│
├── main.py                    ← FastAPI app factory
│                                  CORS middleware (dev: localhost:5173-5175, 3000)
│                                  create_all() on startup
│                                  Routers: /auth, /sessions, /internal
│
├── config.py                  ← Pydantic Settings (env vars with defaults)
│
├── database.py                ← SQLAlchemy engine + SessionLocal factory
│
├── firebase_app.py            ← Firebase Admin SDK init
│                                  Accepts: JSON string or file path env var
│
├── models/
│   ├── user.py                ← User (id, email, firebase_uid, full_name)
│   ├── session.py             ← TutorSession (status, topic, room_name, report_text)
│   ├── message.py             ← ConversationMessage (role, content)
│   └── correction.py         ← GrammarCorrection (original, corrected, explanation)
│
├── schemas/
│   ├── auth.py                ← FirebaseVerifyRequest, UserOut
│   ├── session.py             ← SessionCreate, SessionOut, LiveKitTokenOut
│   └── message.py             ← MessageOut
│
├── api/
│   ├── deps.py                ← get_current_user() — Firebase token → DB User
│   ├── auth.py                ← POST /auth/verify
│   │                               Verifies Firebase ID token
│   │                               Upserts user (firebase_uid → email → create)
│   ├── sessions.py            ← POST/GET /sessions/
│   │                             GET/POST /sessions/{id}
│   │                             POST /sessions/{id}/token    ← LiveKit token
│   │                             POST /sessions/{id}/end      ← triggers report
│   │                             GET  /sessions/{id}/report
│   ├── messages.py            ← GET /sessions/{id}/messages
│   └── agent_callbacks.py     ← POST /internal/agent/message
│                                 POST /internal/agent/correction
│                                 POST /internal/agent/session-ended
│                                 Auth: x-internal-secret header
│
└── services/
    ├── livekit_service.py     ← generate_token(room, identity, name) → JWT
    └── report_service.py      ← generate_session_report(transcript, corrections)
                                    → calls Ollama → Traditional Chinese report
```

### 3-3 Agent Modules

```
livekit-agent/agent/
│
├── main.py                    ← Worker entry point (cli.run_app)
│                                  Validates env vars at startup
│                                  entrypoint(ctx): connects, creates session,
│                                    registers event handlers, starts TutorAgent
│
├── tutor_agent.py             ← class TutorAgent(Agent)
│                                  @function_tool record_grammar_correction()
│                                  @function_tool advance_lesson_state()
│                                  @function_tool get_lesson_state()
│                                  Updates system prompt on state change
│                                  Publishes data to LiveKit data channel
│
├── state_machine.py           ← class TeachingStateMachine
│                                  States: WARMUP → PRACTICE ⇄ CORRECTION
│                                                 → SUMMARY
│                                  Thresholds: 3 warmup turns, 10 practice turns
│
├── prompts.py                 ← build_system_prompt(state, topic) → str
│                                  One prompt per state, role-plays Emma persona
│
└── backend_client.py          ← BackendClient(session_id)
                                   post_message(role, content)
                                   post_correction(original, corrected, explanation)
                                   notify_session_ended()
                                   Uses: INTERNAL_SECRET header, BACKEND_URL
```

---

## 4. Data Flow Pipelines

### 4-1 Login & Registration Pipeline

```
Browser                    Firebase Auth           FastAPI Backend        PostgreSQL
   │                            │                       │                     │
   │──── signInWithPopup() ────►│                       │                     │
   │                            │                       │                     │
   │◄─── Google OAuth ─────────►│                       │                     │
   │                            │                       │                     │
   │◄─── Firebase User ─────────│                       │                     │
   │     (uid, email, name)      │                       │                     │
   │                            │                       │                     │
   │──── getIdToken() ─────────►│                       │                     │
   │◄─── idToken (JWT) ─────────│                       │                     │
   │                            │                       │                     │
   │──────────────── POST /auth/verify {id_token} ─────►│                     │
   │                                                     │                     │
   │                                          verify_id_token()                │
   │                                          (Firebase Admin SDK)             │
   │                                                     │                     │
   │                                                     │── SELECT by uid ───►│
   │                                                     │◄── User or None ────│
   │                                                     │                     │
   │                                                     │── INSERT/UPDATE ───►│
   │                                                     │◄── User ────────────│
   │                                                     │                     │
   │◄──────────────── 200 { id, email, full_name } ──────│                     │
   │                                                     │                     │
   │  setUser(appUser) → Zustand store                   │                     │
   │  navigate("/")                                      │                     │
```

### 4-2 Session Creation & LiveKit Connection Pipeline

```
Browser (Frontend)              FastAPI Backend         LiveKit Cloud
      │                               │                      │
      │── POST /sessions/ {topic} ───►│                      │
      │                               │── INSERT TutorSession│
      │                               │   status=PENDING     │
      │◄── { id: 42 } ───────────────│   room="session-42"  │
      │                               │                      │
      │── POST /sessions/42/token ───►│                      │
      │                               │── generate_token()   │
      │                               │   grants: room_join  │
      │                               │   can_publish        │
      │◄── { token, url } ───────────│                      │
      │                               │                      │
      │──── connect(token, url) ──────────────────────────►  │
      │◄──── WebRTC established ──────────────────────────── │
      │                                                       │
      │                                              LiveKit Agent Worker
      │                                                       │
      │                               ◄─── agent joins "session-42" room ──────│
      │◄──────────── Audio stream established ───────────────────────────────── │
```

### 4-3 Real-time Lesson Execution Pipeline

```
Student (Browser)    LiveKit Cloud    Agent (Python)      FastAPI Backend    PostgreSQL
     │                    │                │                    │                │
     │── speak ──────────►│                │                    │                │
     │                    │── audio ──────►│                    │                │
     │                    │         [STT: disabled]             │                │
     │                    │         [VAD: disabled]             │                │
     │                    │                │                    │                │
     │                    │         LLM (Ollama) generates      │                │
     │                    │         response + corrections      │                │
     │                    │                │                    │                │
     │                    │                │── POST /internal/agent/message ───►│
     │                    │                │── POST /internal/agent/correction ►│
     │                    │                │                    │── INSERT ─────►│
     │                    │                │                    │◄── OK ─────────│
     │                    │                │                    │                │
     │                    │◄── data channel: "tutor.correction" ─┤               │
     │◄── real-time correction card shown ─│                    │                │
     │                    │                │                    │                │
     │                    │◄── TTS audio ──│  (disabled)        │                │
     │◄── Emma replies ───│                │                    │                │
```

### 4-4 Session End & Report Generation Pipeline

```
Browser              FastAPI Backend          Ollama LLM         PostgreSQL
   │                      │                      │                    │
   │── POST /sessions/42/end ──────────────────►│                    │
   │                      │                      │                    │
   │                      │── UPDATE status=ENDED ─────────────────►│
   │                      │── BackgroundTask: generate_report()      │
   │◄── 200 OK ──────────│                      │                    │
   │                      │                      │                    │
   │  (navigate to report)│                      │                    │
   │                      │── SELECT messages + corrections ────────►│
   │                      │◄── transcript, corrections ──────────────│
   │                      │                      │                    │
   │                      │── POST /api/chat ───►│                    │
   │                      │   (prompt: transcript│                    │
   │                      │    + corrections)    │                    │
   │                      │◄── Chinese report ───│                    │
   │                      │                      │                    │
   │                      │── UPDATE report_text ─────────────────►│
   │                      │                      │                    │
   │── GET /sessions/42/report ────────────────►│                    │
   │◄── { status: "ready", report: "..." } ─────│                    │
   │                      │                      │                    │
   │  render ReportPage   │                      │                    │
```

---

## 5. Database Schema

```
┌──────────────────────────────────────────────────────────────┐
│  users                                                        │
│  ─────────────────────────────────────────────────────────── │
│  id            SERIAL PRIMARY KEY                             │
│  email         VARCHAR UNIQUE NOT NULL                        │
│  firebase_uid  VARCHAR UNIQUE NOT NULL                        │
│  full_name     VARCHAR                                        │
│  created_at    TIMESTAMP DEFAULT now()                        │
└──────────────────────┬───────────────────────────────────────┘
                       │ 1:N
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  tutor_sessions                                               │
│  ─────────────────────────────────────────────────────────── │
│  id            SERIAL PRIMARY KEY                             │
│  user_id       INTEGER FK → users.id                         │
│  room_name     VARCHAR UNIQUE  ("session-{id}")               │
│  topic         VARCHAR NOT NULL                               │
│  status        ENUM (pending / active / ended)                │
│  report_text   TEXT  (null until generated)                   │
│  created_at    TIMESTAMP DEFAULT now()                        │
│  ended_at      TIMESTAMP                                      │
└──────────┬──────────────────────┬────────────────────────────┘
           │ 1:N                  │ 1:N
           ▼                      ▼
┌─────────────────────┐  ┌──────────────────────────────────────┐
│  conversation_      │  │  grammar_corrections                  │
│  messages           │  │  ─────────────────────────────────── │
│  ───────────────── │  │  id            SERIAL PK              │
│  id    SERIAL PK   │  │  session_id    FK → tutor_sessions.id │
│  session_id FK     │  │  original_text TEXT NOT NULL          │
│  role  VARCHAR     │  │  corrected_text TEXT NOT NULL         │
│        (student/   │  │  explanation   TEXT                   │
│         tutor)     │  │  created_at    TIMESTAMP              │
│  content TEXT      │  └──────────────────────────────────────┘
│  created_at        │
└─────────────────────┘
```

---

## 6. Authentication Flow

```
                    ┌─────────────────────────────────────────┐
                    │           Authentication Chain           │
                    └─────────────────────────────────────────┘

  Google OAuth 2.0
       │
       ▼
  Firebase Auth  ──── issues ID Token (JWT, 1 hour TTL) ────►  Browser
                                                                    │
                                              axios interceptor auto-attaches:
                                              Authorization: Bearer <idToken>
                                                                    │
                                                                    ▼
                                                          FastAPI: deps.py
                                                          get_current_user()
                                                                    │
                                                     firebase_admin.auth
                                                     .verify_id_token(token)
                                                                    │
                                                    ┌───────────────┴──────────────┐
                                                    │                              │
                                                  Valid                         Invalid
                                                    │                              │
                                              lookup User                      HTTP 401
                                              by firebase_uid
                                                    │
                                                  Found ──► inject as dependency
                                                    │
                                                Not Found ──► HTTP 401

  Agent → Backend:
       Agent uses x-internal-secret header (shared env var)
       agent_callbacks.py validates against INTERNAL_SECRET
       No Firebase token involved for internal calls
```

---

## 7. Agent State Machine

```
                    ┌──────────────┐
                    │   WARMUP     │  instructions: friendly opener,
                    │  (turns 1-3) │  light small talk, build rapport
                    └──────┬───────┘
                           │ turn_count >= 3
                           │ (advance_lesson_state tool)
                           ▼
                    ┌──────────────┐
              ┌────►│  PRACTICE    │  instructions: focused topic practice,
              │     │ (turns 4-13) │  active error detection, richer vocabulary
              │     └──────┬───────┘
              │            │         │
              │   exit_    │         │ error detected
              │   correction│        ▼
              │            │  ┌──────────────┐
              └────────────┼──│  CORRECTION  │  instructions: deliver correction
                           │  │ (transient)  │  gently, model correct form,
                           │  └──────────────┘  reinforce positively
                           │
                           │ turn_count >= 13
                           │ (advance_lesson_state tool)
                           ▼
                    ┌──────────────┐
                    │   SUMMARY    │  instructions: wrap up, highlight progress,
                    │   (final)    │  3 key areas, encourage next session
                    └──────────────┘
                           │
                           │ session.on("close")
                           ▼
                    backend.notify_session_ended()
                    → trigger report generation
```

**State-to-Prompt mapping** (`prompts.py`):

| State | LLM Behavior |
|-------|-------------|
| WARMUP | Emma 自我介紹、輕鬆破冰、詢問今日目標 |
| PRACTICE | 主動帶入主題、偵測語法錯誤、呼叫 `record_grammar_correction` |
| CORRECTION | 指出錯誤、示範正確說法、自然融入對話 |
| SUMMARY | 總結重點、表揚進步、給下次練習建議 |

---

## 8. Deployment Topology

### Docker Compose (Backend + Agent)

```
docker-compose.yml
│
├── postgres           port 5432 ── volume: postgres-data
│   └── health: pg_isready
│
├── backend            port 8000 ── depends_on: postgres (healthy)
│   └── env_file: .env
│   └── override: DATABASE_URL=postgresql://...@postgres:5432/tutordb
│
└── agent              (no exposed port) ── depends_on: backend
    └── env_file: .env
    └── override: BACKEND_URL=http://backend:8000

Network: tutor-net (bridge)
```

### Frontend (Cloudflare Pages)

```
Cloudflare Pages
├── Build: npm run build (Vite)
├── Output: dist/
├── public/_redirects: /* /index.html 200  ← SPA routing
└── Environment Variables:
    VITE_FIREBASE_*             (Firebase client config)
    VITE_API_BASE_URL           (→ backend domain/IP)
```

### External Services

```
┌────────────────────────────────────────────────────────────┐
│  LiveKit Cloud (cloud.livekit.io)                           │
│  Room server + TURN/STUN relays                            │
│  Agent Worker connects here                                 │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Ollama (self-hosted at 192.168.15.235:11434)               │
│  Model: qwen3.5:35b                                         │
│  Used for: lesson LLM + report generation                   │
│  API: OpenAI-compatible (/v1/chat/completions)              │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Firebase (Google Cloud)                                    │
│  Services: Authentication (Google Sign-In)                  │
│  Admin SDK used by backend for token verification           │
└────────────────────────────────────────────────────────────┘
```

### Port Map (Development)

| Service | Port | Notes |
|---------|------|-------|
| Frontend (Vite dev server) | 5173 | Proxies /auth, /sessions, /internal → 8000 |
| Backend (FastAPI) | 8000 | Exposed on host |
| PostgreSQL | 5432 | Exposed on host (for db-shell) |
| Ollama | 11434 | External server, not in Docker |
| LiveKit Cloud | 443 / UDP | External, no local port |

---

*Generated from source code — update this document when adding new services or changing API contracts.*
