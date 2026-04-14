"""
TutorAgent: custom Agent subclass that holds teaching state and
exposes function tools the LLM can call to drive the lesson.
"""
import json
import logging

from livekit.agents import Agent, RunContext, function_tool

from agent.backend_client import BackendClient
from agent.prompts import build_system_prompt
from agent.state_machine import TeachingStateMachine, TeachingState

logger = logging.getLogger(__name__)


class TutorAgent(Agent):
    def __init__(
        self,
        session_id: int,
        backend: BackendClient,
        topic: str = "general conversation",
    ) -> None:
        self.sm = TeachingStateMachine(topic=topic)
        self._session_id = session_id
        self._backend = backend
        super().__init__(
            instructions=build_system_prompt(self.sm.state, topic),
        )

    # ── Function Tools ────────────────────────────────────────────────────────

    @function_tool()
    async def record_grammar_correction(
        self,
        context: RunContext,
        original_text: str,
        corrected_text: str,
        explanation: str,
    ) -> str:
        """Record a grammar or vocabulary correction when the student makes a clear error.

        Args:
            original_text: The incorrect sentence or phrase the student said.
            corrected_text: The grammatically correct version.
            explanation: A brief, encouraging explanation of the error (1-2 sentences).
        """
        logger.info(
            "[%d] 🔧 TOOL record_grammar_correction\n"
            "          original:    %s\n"
            "          corrected:   %s\n"
            "          explanation: %s",
            self._session_id, original_text, corrected_text, explanation,
        )

        self.sm.record_correction(original_text, corrected_text, explanation)

        await self._backend.post_correction(
            original=original_text,
            corrected=corrected_text,
            explanation=explanation,
        )

        await _publish_to_room(
            context,
            topic="tutor.correction",
            payload={
                "type": "correction",
                "original": original_text,
                "corrected": corrected_text,
                "explanation": explanation,
            },
        )

        self.sm.exit_correction()
        self.instructions = build_system_prompt(self.sm.state, self.sm.topic)

        logger.debug(
            "[%d] 🔧 correction done — state=%s corrections_total=%d",
            self._session_id, self.sm.state, self.sm.correction_count,
        )
        return "Correction recorded and sent to student."

    @function_tool()
    async def advance_lesson_state(self, context: RunContext) -> str:
        """Advance to the next phase of the lesson when the current phase objectives are complete."""
        previous = self.sm.state
        self.sm.advance()
        self.instructions = build_system_prompt(self.sm.state, self.sm.topic)

        logger.info(
            "[%d] 📈 TOOL advance_lesson_state  %s → %s  (turn=%d)",
            self._session_id, previous, self.sm.state, self.sm.turn_count,
        )

        await _publish_to_room(
            context,
            topic="tutor.state",
            payload={"type": "state_change", "state": self.sm.state},
        )

        return f"Lesson advanced from {previous} to {self.sm.state}."

    @function_tool()
    async def get_lesson_state(self, context: RunContext) -> str:
        """Get the current lesson state and progress information."""
        result = (
            f"State: {self.sm.state}, "
            f"Turns: {self.sm.turn_count}, "
            f"Corrections made: {self.sm.correction_count}"
        )
        logger.debug("[%d] 📊 TOOL get_lesson_state  %s", self._session_id, result)
        return result


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _publish_to_room(context: RunContext, topic: str, payload: dict) -> None:
    """Send a JSON data packet to the frontend via the LiveKit room data channel."""
    try:
        data = json.dumps(payload).encode()
        room = context.session.room
        await room.local_participant.publish_data(data, reliable=True, topic=topic)
        logger.debug("Published data  topic=%s  payload=%s", topic, payload)
    except Exception as exc:
        logger.warning("publish_data failed  topic=%s  error=%s", topic, exc)
