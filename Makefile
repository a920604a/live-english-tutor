# ── Compose 組合變數 ──────────────────────────────────────────────────────────
#
#  C_CORE   = 核心基礎（postgres + backend + tts）
#  C_GEMINI = 核心 + agent（AGENT_MODE=gemini，使用 Google Gemini Realtime）
#  C_LOCAL  = 核心 + agent + ollama（AGENT_MODE=local，完全本機）
#  C_LIVEKIT= Self-hosted LiveKit server（獨立，需先啟動 C_CORE）
#
C_CORE    = docker compose -f docker-compose.yml
C_GEMINI  = $(C_CORE) -f docker-compose.agent.yml
C_LOCAL   = $(C_GEMINI) -f docker-compose.ollama.yml
C_LIVEKIT = docker compose -f docker-compose.livekit.yml
CURL_IMAGE ?= curlimages/curl:8.10.1
C_CURL     = docker run --rm --network tutor-net $(CURL_IMAGE)

.PHONY: help \
        up-core up-gemini up-local down restart \
        rebuild-gemini rebuild-local \
        ps \
        livekit-up livekit-down \
        logs logs-backend logs-agent logs-db logs-ollama logs-livekit \
        fe-install fe-dev fe-build \
        db-shell \
        env clean \
        model-pull model-list \
        update-libs \
        test-ollama test-tts test-stt test-stt-file

# ── 預設目標 ──────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Live English Tutor — 開發指令"
	@echo "  =============================="
	@echo ""
	@echo "  ▸ 啟動模式（擇一）"
	@echo "    make up-core          只啟動基礎服務（postgres + backend + tts）"
	@echo "    make up-gemini        Gemini 模式（核心 + agent，需 GOOGLE_API_KEY）"
	@echo "    make up-local         Local 模式（核心 + agent + ollama，完全本機）"
	@echo ""
	@echo "  ▸ Self-hosted LiveKit（選配，需先啟動上方任一模式）"
	@echo "    make livekit-up       啟動自架 LiveKit server"
	@echo "    make livekit-down     停止自架 LiveKit server"
	@echo ""
	@echo "  ▸ 停止 / 重建"
	@echo "    make down             停止所有服務"
	@echo "    make restart          重新啟動目前執行中的服務"
	@echo "    make rebuild-gemini   重建 agent image（gemini 模式）"
	@echo "    make rebuild-local    重建 agent image（local 模式）"
	@echo "    make ps               顯示所有服務狀態"
	@echo ""
	@echo "  ▸ Log"
	@echo "    make logs             所有服務 log"
	@echo "    make logs-backend     backend log"
	@echo "    make logs-agent       agent log"
	@echo "    make logs-db          postgres log"
	@echo "    make logs-ollama      ollama log"
	@echo "    make logs-livekit     livekit log"
	@echo ""
	@echo "  ▸ 前端"
	@echo "    make fe-install       安裝前端 npm 套件"
	@echo "    make fe-dev           啟動前端開發 server（port 5173）"
	@echo "    make fe-build         建置前端生產版本"
	@echo ""
	@echo "  ▸ 資料庫"
	@echo "    make db-shell         進入 PostgreSQL 互動介面"
	@echo ""
	@echo "  ▸ 其他"
	@echo "    make env              從 .env.example 建立 .env"
	@echo "    make clean            停止並移除所有 volumes（資料會遺失）"
	@echo "    make model-pull       下載 Ollama 模型（預設 llama3.2:3b）"
	@echo "    make model-pull MODEL=llama3.2:1b  下載指定模型"
	@echo "    make model-list       列出已下載的 Ollama 模型"
	@echo "    make update-libs      更新 stt-tts-unified submodule"
	@echo ""
	@echo "  ▸ 元件測試（local 模式）"
	@echo "    make test-ollama      測試 Ollama LLM（模型是否就緒、可回應）"
	@echo "    make test-ollama MSG=\"...\"  傳入自訂問題"
	@echo "    make test-tts         測試 EdgeTTS（網路是否可達、音訊是否產生）"
	@echo "    make test-tts TEXT=\"...\"   傳入自訂文字"
	@echo "    make test-stt         測試 Whisper STT HTTP API 是否就緒"
	@echo "    make test-stt-file AUDIO=sample.wav  上傳音檔並啟動轉錄"
	@echo ""

# ── 啟動 ──────────────────────────────────────────────────────────────────────
up-core:
	$(C_CORE) up -d

up-gemini:
	$(C_GEMINI) up -d

up-local:
	$(C_LOCAL) up -d

livekit-up:
	$(C_LIVEKIT) up -d

# ── 停止 / 重啟 ───────────────────────────────────────────────────────────────
down:
	$(C_LOCAL) down

livekit-down:
	$(C_LIVEKIT) down

restart:
	$(C_LOCAL) restart

# ── 重建 Image ────────────────────────────────────────────────────────────────
rebuild-gemini:
	$(C_GEMINI) up -d --build

rebuild-local:
	$(C_LOCAL) up -d --build

# ── 狀態 ──────────────────────────────────────────────────────────────────────
ps:
	$(C_LOCAL) ps

# ── Log ───────────────────────────────────────────────────────────────────────
logs:
	$(C_LOCAL) logs -f

logs-backend:
	$(C_CORE) logs -f backend

logs-agent:
	$(C_GEMINI) logs -f agent

logs-db:
	$(C_CORE) logs -f postgres

logs-ollama:
	$(C_LOCAL) logs -f ollama

logs-livekit:
	$(C_LIVEKIT) logs -f livekit

# ── 前端 ──────────────────────────────────────────────────────────────────────
fe-install:
	cd frontend-web && npm install

fe-dev:
	cd frontend-web && npm run dev

fe-build:
	cd frontend-web && npm run build

# ── 資料庫 ────────────────────────────────────────────────────────────────────
db-shell:
	$(C_CORE) exec postgres psql -U tutor -d tutordb

# ── 環境設定 ──────────────────────────────────────────────────────────────────
env:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo ".env 已從 .env.example 建立，請填入實際的 API Keys"; \
	else \
		echo ".env 已存在，略過"; \
	fi

# ── 清理 ──────────────────────────────────────────────────────────────────────
clean:
	@echo "警告：這將移除所有 Docker volumes（包含資料庫資料）"
	@read -p "確定要繼續嗎？[y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	$(C_LOCAL) down -v

# ── Ollama 模型管理 ────────────────────────────────────────────────────────────
model-pull:
	$(C_LOCAL) exec ollama ollama pull $(or $(MODEL),llama3.2:3b)

model-list:
	$(C_LOCAL) exec ollama ollama list

# ── 元件測試 ──────────────────────────────────────────────────────────────────
#
#  test-ollama    用 curl container 呼叫 Ollama API（測試 LLM 是否可達、模型是否載入）
#  test-tts       用 curl container 呼叫 TTS streaming API（測試 TTS 是否產生音訊）
#  test-stt       用 curl container 呼叫 STT health/models API（測試 Whisper API 是否就緒）
#  test-stt-file  用 curl container 上傳本機音檔並啟動 Whisper 轉錄
#
#  用法範例：
#    make test-ollama
#    make test-ollama MSG="Explain past tense in one sentence."
#    make test-tts TEXT="Hello, I am Emma."
#    make test-stt
#    make test-stt-file AUDIO=./sample.wav MODEL=tiny LANGUAGE=en

test-ollama:
	@echo "=== Ollama generate API ==="
	$(C_CURL) -fsS --max-time 120 \
		-H "Content-Type: application/json" \
		-d '{"model":"$(or $(MODEL),llama3.2:3b)","prompt":"$(or $(MSG),Say hello in one sentence.)","stream":false}' \
		http://ollama:11434/api/generate

test-tts:
	@echo "=== TTS stream API ==="
	$(C_CURL) -fsS --max-time 120 \
		-o /dev/null \
		-w 'http_code=%{http_code}\ncontent_type=%{content_type}\nbytes=%{size_download}\ntime=%{time_total}s\n' \
		-H "Content-Type: application/json" \
		-d '{"text":"$(or $(TEXT),Hello, I am Emma your English tutor.)","voice":"$(or $(VOICE),en-US-JennyNeural)"}' \
		http://tts:8000/api/tts/stream

test-stt:
	@echo "=== STT health API ==="
	$(C_CURL) -fsS --max-time 30 http://tts:8000/api/stt/health
	@echo ""
	@echo "=== STT models API ==="
	$(C_CURL) -fsS --max-time 30 http://tts:8000/api/stt/models
	@echo ""

test-stt-file:
	@test -n "$(AUDIO)" || (echo "請指定音檔：make test-stt-file AUDIO=./sample.wav"; exit 1)
	@test -f "$(AUDIO)" || (echo "找不到音檔：$(AUDIO)"; exit 1)
	@echo "=== STT upload + transcribe API ==="
	$(C_CURL) -fsS --max-time 60 \
		-v "$(abspath $(AUDIO)):/tmp/input-audio:ro" \
		-F "file=@/tmp/input-audio" \
		http://tts:8000/api/stt/upload \
		-o /tmp/stt-upload.json
	@file_id="$$(docker run --rm -v /tmp/stt-upload.json:/tmp/stt-upload.json:ro $(CURL_IMAGE) sh -c "sed -n 's/.*\"file_id\":\"\([^\"]*\)\".*/\1/p' /tmp/stt-upload.json")"; \
		test -n "$$file_id" || (echo "無法解析 file_id"; cat /tmp/stt-upload.json; exit 1); \
		echo "file_id=$$file_id"; \
		$(C_CURL) -fsS --max-time 30 \
			-H "Content-Type: application/json" \
			-d "{\"file_id\":\"$$file_id\",\"model_size\":\"$(or $(MODEL),tiny)\",\"language\":\"$(or $(LANGUAGE),auto)\",\"include_timestamps\":false}" \
			http://tts:8000/api/stt/transcribe; \
		echo ""; \
		echo "查詢狀態：make test-stt-status FILE_ID=$$file_id"

# ── 函式庫更新 ─────────────────────────────────────────────────────────────────
update-libs:
	git submodule update --remote libs/stt-tts-unified
