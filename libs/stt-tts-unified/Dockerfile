# ── Stage 1: Build React frontend ──────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Output: /app/frontend/dist

# ── Stage 2: Python runtime ─────────────────────────────────────────
FROM python:3.11-slim AS runtime

# ffmpeg is required by Whisper for audio decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install Python dependencies via uv sync (reads pyproject.toml)
# torch/torchaudio are pulled from CPU-only index defined in [tool.uv.sources]
COPY pyproject.toml ./
RUN uv sync --no-dev --no-install-project

# Put the venv on PATH so plain `python` / `uvicorn` use it
ENV PATH="/app/.venv/bin:$PATH"

# Copy backend source
COPY backend/ ./backend/

# Copy React build from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Pre-download default Whisper model (base, ~74 MB) so first request is instant
RUN python -c "import whisper; whisper.load_model('base')"

# Runtime data directories
RUN mkdir -p data/uploads data/results data/audio

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
