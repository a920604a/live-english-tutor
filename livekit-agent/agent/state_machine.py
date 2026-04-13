"""
Teaching state machine that drives the lesson flow.
The agent consults this to select the appropriate system prompt
and decide when to correct errors vs. let the student keep speaking.
"""
import enum
from dataclasses import dataclass, field


class TeachingState(str, enum.Enum):
    WARMUP = "warmup"
    PRACTICE = "practice"
    CORRECTION = "correction"
    SUMMARY = "summary"


@dataclass
class TeachingStateMachine:
    topic: str
    state: TeachingState = TeachingState.WARMUP
    turn_count: int = 0
    correction_count: int = 0
    _corrections: list[dict] = field(default_factory=list)

    # Thresholds — how many student turns in each phase before advancing
    WARMUP_TURNS: int = 3
    PRACTICE_TURNS: int = 13  # WARMUP(3) + PRACTICE(10) = 13 total before SUMMARY

    def advance(self) -> None:
        """Call after each completed student turn."""
        self.turn_count += 1
        if self.state == TeachingState.WARMUP and self.turn_count >= self.WARMUP_TURNS:
            self.state = TeachingState.PRACTICE
        elif self.state == TeachingState.PRACTICE and self.turn_count >= self.PRACTICE_TURNS:
            self.state = TeachingState.SUMMARY

    def record_correction(self, original: str, corrected: str, explanation: str) -> None:
        self.correction_count += 1
        self._corrections.append(
            {"original": original, "corrected": corrected, "explanation": explanation}
        )
        self.state = TeachingState.CORRECTION

    def exit_correction(self) -> None:
        """Return to PRACTICE after correction is delivered."""
        if self.state == TeachingState.CORRECTION:
            self.state = TeachingState.PRACTICE

    def get_corrections(self) -> list[dict]:
        return list(self._corrections)

    @property
    def is_finished(self) -> bool:
        return self.state == TeachingState.SUMMARY
