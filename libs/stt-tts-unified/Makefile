# ─────────────────────────────────────────────────────────────────────────────
# STT-TTS Unified — Makefile
# ─────────────────────────────────────────────────────────────────────────────

SHELL := /bin/bash
.DEFAULT_GOAL := help

# ── Paths ─────────────────────────────────────────────────────────────────────
BACKEND_DIR  := backend
FRONTEND_DIR := frontend

# ─────────────────────────────────────────────────────────────────────────────
# HELP
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@printf "\nSTT-TTS Unified\n\n"
	@printf "Development\n"
	@printf "  make install        Install all dependencies\n"
	@printf "  make dev            Start backend + frontend\n"
	@printf "  make dev-backend    Backend only\n"
	@printf "  make dev-frontend   Frontend only\n"
	@printf "\n"
	@printf "Build\n"
	@printf "  make build          Build frontend\n"
	@printf "  make build-docker   Build Docker image\n"
	@printf "\n"
	@printf "Docker\n"
	@printf "  make up             docker compose up\n"
	@printf "  make down           docker compose down\n"
	@printf "  make logs           Tail logs\n"
	@printf "  make restart        Restart container\n"
	@printf "  make shell          Shell into container\n"
	@printf "\n"
	@printf "Quality\n"
	@printf "  make lint           Ruff + tsc\n"
	@printf "  make fmt            Format all\n"
	@printf "  make typecheck      TS only\n"
	@printf "\n"
	@printf "Maintenance\n"
	@printf "  make clean\n"
	@printf "  make clean-data\n"
	@printf "  make reset\n"
	@printf "\n"

# ─────────────────────────────────────────────────────────────────────────────
# INSTALL
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: install install-backend install-frontend

install: install-backend install-frontend
	@printf "All dependencies installed\n"

install-backend:
	@printf "Installing backend dependencies...\n"
	uv sync --no-dev
	@printf "Backend installed\n"

install-frontend:
	@printf "Installing frontend dependencies...\n"
	cd $(FRONTEND_DIR) && npm install --silent
	@printf "Frontend installed\n"

# ─────────────────────────────────────────────────────────────────────────────
# DEVELOPMENT
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: dev dev-backend dev-frontend

dev: install
	@printf "Starting backend + frontend...\n"
	@trap 'kill %1 %2 2>/dev/null' EXIT; \
	  DEV_MODE=true uv run uvicorn $(BACKEND_DIR).main:app --reload --port 8008 & \
	  cd $(FRONTEND_DIR) && npm run dev & \
	  wait

dev-backend:
	@printf "Backend on :8008\n"
	DEV_MODE=true uv run uvicorn $(BACKEND_DIR).main:app --reload --port 8008

dev-frontend:
	@printf "Frontend on :5173\n"
	cd $(FRONTEND_DIR) && npm run dev

# ─────────────────────────────────────────────────────────────────────────────
# BUILD
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: build build-docker

build:
	@printf "Building frontend...\n"
	cd $(FRONTEND_DIR) && npm run build
	@printf "Built\n"

build-docker:
	@printf "Building Docker image...\n"
	docker build -t stt-tts-unified .
	@printf "Docker built\n"

# ─────────────────────────────────────────────────────────────────────────────
# DOCKER
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: up down logs restart shell

up:
	@printf "Starting services...\n"
	docker compose up --build -d
	@printf "Running at http://localhost:8080\n"

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

restart:
	docker compose restart app

shell:
	docker compose exec app /bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# QUALITY
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: lint fmt typecheck

lint: lint-python typecheck

lint-python:
	@printf "Linting Python...\n"
	uvx ruff check $(BACKEND_DIR) || true

typecheck:
	@printf "Type-checking TS...\n"
	cd $(FRONTEND_DIR) && npx tsc --noEmit
	@printf "TS OK\n"

fmt: fmt-python fmt-frontend

fmt-python:
	@printf "Formatting Python...\n"
	uvx ruff format $(BACKEND_DIR)

fmt-frontend:
	@printf "Formatting frontend...\n"
	cd $(FRONTEND_DIR) && npx prettier --write "src/**/*.{ts,tsx,css}" --log-level warn

# ─────────────────────────────────────────────────────────────────────────────
# MAINTENANCE
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: clean clean-data reset

clean:
	@printf "Cleaning build artefacts...\n"
	rm -rf $(FRONTEND_DIR)/dist
	find . -type d -name __pycache__ -not -path "./.venv/*" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -not -path "./.venv/*" -delete 2>/dev/null || true
	@printf "Clean\n"

clean-data:
	@printf "Removing runtime data...\n"
	rm -rf data/uploads/* data/results/* data/audio/* data/history.db 2>/dev/null || true
	@printf "Data cleared\n"

reset: clean clean-data
	@printf "Full reset complete\n"
