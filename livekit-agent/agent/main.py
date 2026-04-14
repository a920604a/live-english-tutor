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

    session_id = _parse_session_id(ctx.room.name)
    topic = ctx.room.metadata or "general conversation"

    logger.info(
        "━━ Session START  room=%s  session_id=%d  topic=%s",
        ctx.room.name, session_id, topic,
    )

    backend = BackendClient(session_id=session_id)

    # ── Room-level participant events ─────────────────────────────────────────

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant) -> None:
        logger.info(
            "[%d] 👤 Participant joined   identity=%s  name=%s",
            session_id, participant.identity, participant.name or "(no name)",
        )

    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(participant) -> None:
        logger.info(
            "[%d] 👋 Participant left    identity=%s",
            session_id, participant.identity,
        )

    # ── AgentSession ──────────────────────────────────────────────────────────

    session = AgentSession(
        # Google Gemini Realtime: handles voice input (STT) + reasoning (LLM) + voice output (TTS)
        # in a single native audio model — no separate STT/TTS services required.
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-2.5-flash-native-audio-preview-12-2025",
        ),
    )

    agent = TutorAgent(session_id=session_id, backend=backend, topic=topic)

    # ── Session-level events ──────────────────────────────────────────────────

    @session.on("agent_state_changed")
    def on_agent_state_changed(event) -> None:
        # state: idle / listening / thinking / speaking
        state = getattr(event, "state", event)
        logger.debug("[%d] 🤖 Agent state → %s", session_id, state)

    @session.on("user_input_transcribed")
    async def on_transcript(event) -> None:
        if not event.is_final:
            return
        text = event.transcript
        logger.info("[%d] 🎤 STUDENT  %s", session_id, text)
        await backend.post_message(role="student", content=text)

    @session.on("agent_speech_committed")
    async def on_agent_speech(event) -> None:
        content = str(event.user_msg)
        preview = content[:150] + ("…" if len(content) > 150 else "")
        logger.info("[%d] 🔊 EMMA     %s", session_id, preview)
        await backend.post_message(role="tutor", content=content)

    @session.on("agent_speech_interrupted")
    def on_agent_speech_interrupted(event) -> None:
        logger.info("[%d] ✋ EMMA speech interrupted by student", session_id)

    @session.on("close")
    async def on_close(event) -> None:
        logger.info("━━ Session END    session_id=%d", session_id)
        await backend.notify_session_ended()

    # Job shutdown fallback — fires on crash / OOM / forced termination.
    async def _on_job_shutdown(reason: str) -> None:
        logger.warning(
            "━━ Job shutdown   room=%s  session_id=%d  reason=%s",
            ctx.room.name, session_id, reason,
        )
        if not backend._client.is_closed:
            await backend.notify_session_ended()

    ctx.add_shutdown_callback(_on_job_shutdown)

    await session.start(agent=agent, room=ctx.room)

    logger.info("[%d] 💬 Sending initial greeting", session_id)
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
