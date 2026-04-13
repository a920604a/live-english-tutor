"""
HTTP client for posting events from the agent back to the FastAPI backend.
Uses a shared internal secret header for authentication.
"""
import os

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "internal-agent-secret")

_HEADERS = {"x-internal-secret": INTERNAL_SECRET}


class BackendClient:
    def __init__(self, session_id: int) -> None:
        self._session_id = session_id

    async def post_message(self, role: str, content: str) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{BACKEND_URL}/internal/agent/message",
                json={"session_id": self._session_id, "role": role, "content": content},
                headers=_HEADERS,
            )

    async def post_correction(
        self, original: str, corrected: str, explanation: str
    ) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{BACKEND_URL}/internal/agent/correction",
                json={
                    "session_id": self._session_id,
                    "original_text": original,
                    "corrected_text": corrected,
                    "explanation": explanation,
                },
                headers=_HEADERS,
            )

    async def notify_session_ended(self) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{BACKEND_URL}/internal/agent/session-ended",
                params={"session_id": self._session_id},
                headers=_HEADERS,
            )
