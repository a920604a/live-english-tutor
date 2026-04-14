"""
LiveKit Agent Worker entry point.

Run with:
    python -m agent.main start          # production
    python -m agent.main dev            # dev mode (auto-reconnect)
"""
import logging
import os

from dotenv import load_dotenv

load_dotenv()

from livekit.agents import AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import google

from agent.backend_client import BackendClient
from agent.tutor_agent import TutorAgent

logger = logging.getLogger(__name__)

# ── Required environment variable validation ──────────────────────────────────
_REQUIRED_ENV = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "GOOGLE_API_KEY"]
_missing = [k for k in _REQUIRED_ENV if not os.getenv(k)]
if _missing:
    raise RuntimeError(
        f"Missing required environment variables: {', '.join(_missing)}\n"
        "Please set them in your .env file."
    )


# ── Session entrypoint ────────────────────────────────────────────────────────

async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    # Parse session_id from room name convention "session-{id}"
    session_id = _parse_session_id(ctx.room.name)
    topic = ctx.room.metadata or "general conversation"  # frontend sets topic in room metadata

    backend = BackendClient(session_id=session_id)
    logger.info("Agent joined room %s (session_id=%d, topic=%s)", ctx.room.name, session_id, topic)

    session = AgentSession(
        # Google Gemini Realtime: handles voice input (STT) + reasoning (LLM) + voice output (TTS)
        # in a single native audio model — no separate STT/TTS services required.
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-2.5-flash-native-audio-preview-12-2025",
        ),
    )

    agent = TutorAgent(session_id=session_id, backend=backend, topic=topic)

    # Persist conversation messages to backend
    @session.on("user_input_transcribed")
    async def on_transcript(event) -> None:
        if event.is_final:
            await backend.post_message(role="student", content=event.transcript)

    @session.on("agent_speech_committed")
    async def on_agent_speech(event) -> None:
        await backend.post_message(role="tutor", content=str(event.user_msg))

    @session.on("close")
    async def on_close(event) -> None:
        await backend.notify_session_ended()  # also calls backend.aclose()
        logger.info("Session %d ended", session_id)

    # Job shutdown fallback — fires on crash / OOM / forced termination
    # where session "close" event may not have had a chance to run.
    async def _on_job_shutdown(reason: str) -> None:
        logger.info(
            "Job shutdown: room=%s session_id=%d reason=%s",
            ctx.room.name, session_id, reason,
        )
        if not backend._client.is_closed:
            # notify_session_ended was not called yet — best-effort fire
            await backend.notify_session_ended()

    ctx.add_shutdown_callback(_on_job_shutdown)

    await session.start(agent=agent, room=ctx.room)

    # Kick off the lesson with a greeting
    await session.generate_reply(
        instructions="Greet the student warmly by name if possible, introduce yourself as Emma, "
        "and begin the warm-up phase with a friendly opening question."
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_session_id(room_name: str) -> int:
    """Extract session id from room name 'session-{id}'."""
    try:
        return int(room_name.split("-", 1)[1])
    except (IndexError, ValueError):
        return 0


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )
