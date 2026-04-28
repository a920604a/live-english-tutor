#!/usr/bin/env bash
# Start backend and frontend concurrently for local development
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Backend
cd "$ROOT"
if [ ! -d ".venv" ]; then
  python -m venv .venv
  .venv/bin/pip install -r backend/requirements.txt
fi
DEV_MODE=true .venv/bin/uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!
echo "Backend started (PID $BACKEND_PID) on http://localhost:8008"

# Frontend
cd "$ROOT/frontend"
npm install --silent
npm run dev &
FRONTEND_PID=$!
echo "Frontend started (PID $FRONTEND_PID) on http://localhost:5173"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM
wait
