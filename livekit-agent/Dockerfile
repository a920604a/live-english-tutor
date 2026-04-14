FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# System deps for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml .
RUN uv sync --no-cache

# Pre-download Silero VAD model weights at build time
# Bakes the .onnx weights into the image so runtime has zero cold-start delay
RUN uv run python -c "from livekit.plugins import silero; silero.VAD.load()"

COPY . .

CMD ["uv", "run", "python", "-m", "agent.main", "start"]
