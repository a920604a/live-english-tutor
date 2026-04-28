.PHONY: help up down restart rebuild ps \
        logs logs-backend logs-agent logs-db \
        livekit-up livekit-down livekit-logs \
        fe-install fe-dev fe-build \
        db-shell env clean

# ── 預設目標 ──────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "Live English Tutor — 開發指令"
	@echo "=================================="
	@echo ""
	@echo "  Docker 服務"
	@echo "  -----------"
	@echo "  make up            啟動所有服務（背景執行）"
	@echo "  make down          停止所有服務"
	@echo "  make restart       重新啟動所有服務"
	@echo "  make rebuild       重新建置 image 並啟動"
	@echo "  make ps            顯示服務狀態"
	@echo ""
	@echo "  Self-hosted LiveKit（選配，獨立啟動）"
	@echo "  -------------------------------------"
	@echo "  make livekit-up    啟動自架 LiveKit server（需先 make up）"
	@echo "  make livekit-down  停止自架 LiveKit server"
	@echo "  make livekit-logs  追蹤 LiveKit server log"
	@echo ""
	@echo "  Log 查看"
	@echo "  --------"
	@echo "  make logs          追蹤所有服務的 log"
	@echo "  make logs-backend  追蹤 backend log"
	@echo "  make logs-agent    追蹤 agent log"
	@echo "  make logs-db       追蹤 postgres log"
	@echo ""
	@echo "  前端"
	@echo "  ----"
	@echo "  make fe-install    安裝前端 npm 套件"
	@echo "  make fe-dev        啟動前端開發伺服器（port 5173）"
	@echo "  make fe-build      建置前端生產版本"
	@echo ""
	@echo "  資料庫"
	@echo "  ------"
	@echo "  make db-shell      進入 PostgreSQL 互動介面"
	@echo ""
	@echo "  環境設定"
	@echo "  --------"
	@echo "  make env           從 .env.example 建立 .env（已存在則略過）"
	@echo ""
	@echo "  清理"
	@echo "  ----"
	@echo "  make clean         停止服務並移除所有 volumes（資料會遺失）"
	@echo ""

# ── Docker 服務管理 ───────────────────────────────────────────────────────────
up:
	docker compose up -d

down:
	docker compose down

restart: down up

rebuild:
	docker compose up -d --build

ps:
	docker compose ps

# ── Log 查看 ──────────────────────────────────────────────────────────────────
logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-agent:
	docker compose logs -f agent

logs-db:
	docker compose logs -f postgres

# ── 前端 ──────────────────────────────────────────────────────────────────────
fe-install:
	cd frontend-web && npm install

fe-dev:
	cd frontend-web && npm run dev

fe-build:
	cd frontend-web && npm run build

# ── 資料庫 ────────────────────────────────────────────────────────────────────
db-shell:
	docker compose exec postgres psql -U tutor -d tutordb

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
	docker compose down -v

# ── Self-hosted LiveKit（獨立 Compose）───────────────────────────────────────
# 使用方式：先 make up，再 make livekit-up
# .env 需設定：
#   LIVEKIT_URL=ws://livekit:7880          (Agent 用，Docker 內部)
#   LIVEKIT_PUBLIC_URL=ws://localhost:7880  (瀏覽器用，backend 回傳)
livekit-up:
	docker compose -f docker-compose.livekit.yml up -d

livekit-down:
	docker compose -f docker-compose.livekit.yml down

livekit-logs:
	docker compose -f docker-compose.livekit.yml logs -f livekit
