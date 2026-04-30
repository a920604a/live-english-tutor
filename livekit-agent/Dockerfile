FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# System deps for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy stt-tts-unified so path dep "../libs/stt-tts-unified" resolves from /app
# (pyproject.toml uses path = "../libs/stt-tts-unified", WORKDIR=/app → /libs/stt-tts-unified)
COPY libs/stt-tts-unified /libs/stt-tts-unified

# Install Python dependencies (using lock file for reproducible builds)
COPY livekit-agent/pyproject.toml livekit-agent/uv.lock ./
RUN uv sync --no-cache --frozen

COPY livekit-agent/agent ./agent

CMD ["uv", "run", "python", "-m", "agent.main", "start"]
