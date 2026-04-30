import logging
import os

import httpx

from livekit.agents import AgentSession
from livekit.agents.stt import StreamAdapter
from livekit.agents.types import APIConnectOptions
from livekit.agents.voice.agent_session import SessionConnectOptions
from livekit.plugins import google, openai, silero

from backend.services.kokoro_service import KokoroEngine
from backend.services.tts_service import EdgeTTSEngine
from backend.services.whisper_service import WhisperEngine
from agent.plugins.kokoro_tts import KokoroTTSPlugin
from agent.plugins.edge_tts import EdgeTTSPlugin
from agent.plugins.whisper_stt import WhisperSTT

logger = logging.getLogger(__name__)

_VALID_MODES = ["gemini", "local"]
_VALID_TTS_ENGINES = ["kokoro", "edge-tts"]


def _probe_ollama(base_url: str, model: str) -> None:
    """Synchronous Ollama health probe — logs reachability and whether the model is loaded."""
    api_root = base_url.rstrip("/").removesuffix("/v1")
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(f"{api_root}/api/tags")
            r.raise_for_status()
            available = [m["name"] for m in r.json().get("models", [])]
            matched = any(m == model or m.startswith(f"{model}:") for m in available)
            if matched:
                logger.info("Ollama ✓  url=%s  model=%s  available=%s", api_root, model, available)
            else:
                logger.warning(
                    "Ollama model not found!  url=%s  wanted=%s  available=%s",
                    api_root, model, available,
                )
    except Exception as exc:
        logger.error("Ollama unreachable  url=%s  error=%s", api_root, exc)


def create_session(mode: str) -> AgentSession:
    mode = (mode or "gemini").strip().lower()

    if mode not in _VALID_MODES:
        raise RuntimeError(
            f"Invalid AGENT_MODE={mode!r}. Valid values: {_VALID_MODES}"
        )

    if mode == "gemini":
        return AgentSession(
            llm=google.beta.realtime.RealtimeModel(
                model="gemini-2.5-flash-native-audio-preview-12-2025",
            ),
        )

    # local mode ──────────────────────────────────────────────────────────────
    ollama_base_url = os.getenv("OLLAMA_BASE_URL")
    ollama_model = os.getenv("OLLAMA_MODEL")
    if not ollama_base_url or not ollama_model:
        raise RuntimeError(
            "AGENT_MODE=local requires OLLAMA_BASE_URL and OLLAMA_MODEL environment variables."
        )

    tts_engine_name = (os.getenv("TTS_ENGINE") or "kokoro").strip().lower()
    if tts_engine_name not in _VALID_TTS_ENGINES:
        raise RuntimeError(
            f"Invalid TTS_ENGINE={tts_engine_name!r}. Valid values: {_VALID_TTS_ENGINES}"
        )

    logger.info(
        "local mode  ollama=%s  model=%s  tts=%s",
        ollama_base_url, ollama_model, tts_engine_name,
    )
    _probe_ollama(ollama_base_url, ollama_model)

    # STT: Whisper batch + Silero VAD → streaming STT via StreamAdapter
    whisper_engine = WhisperEngine()
    stt_plugin = StreamAdapter(stt=WhisperSTT(engine=whisper_engine), vad=silero.VAD.load())

    # LLM: Ollama via OpenAI-compatible API
    # Ollama doesn't validate API keys, but the openai client requires a non-empty value.
    ollama_api_key = os.getenv("OLLAMA_API_KEY", "ollama")
    llm_plugin = openai.LLM(base_url=ollama_base_url, model=ollama_model, api_key=ollama_api_key)

    # TTS
    if tts_engine_name == "kokoro":
        kokoro_model_path = os.getenv("KOKORO_MODEL_PATH", "models/kokoro-v1.0.onnx")
        kokoro_voices_path = os.getenv("KOKORO_VOICES_PATH", "models/voices-v1.0.bin")
        kokoro_voice = os.getenv("KOKORO_VOICE", "af_heart")
        tts_plugin = KokoroTTSPlugin(
            engine=KokoroEngine(
                model_path=kokoro_model_path,
                voices_path=kokoro_voices_path,
                default_voice=kokoro_voice,
            ),
            voice=kokoro_voice,
        )
    else:  # edge-tts
        edge_voice = os.getenv("EDGE_TTS_VOICE", "en-US-JennyNeural")
        tts_plugin = EdgeTTSPlugin(
            engine=EdgeTTSEngine(default_voice=edge_voice),
            voice=edge_voice,
        )

    # CPU Ollama TTFT can exceed the default 10s timeout; use generous limits.
    local_conn_options = SessionConnectOptions(
        llm_conn_options=APIConnectOptions(max_retry=2, retry_interval=5.0, timeout=120.0),
        tts_conn_options=APIConnectOptions(max_retry=2, retry_interval=3.0, timeout=60.0),
    )

    return AgentSession(stt=stt_plugin, llm=llm_plugin, tts=tts_plugin, conn_options=local_conn_options)
