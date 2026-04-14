"""
HTTP client for posting events from the agent back to the FastAPI backend.
Uses a shared internal secret header for authentication.

Design: one persistent AsyncClient per BackendClient instance (= per session).
This avoids the overhead of opening a new TCP connection for every API call.
Call `aclose()` (or use as async context manager) when the session ends.
"""
import logging
import os

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "internal-agent-secret")

logger = logging.getLogger(__name__)


class BackendClient:
    def __init__(self, session_id: int) -> None:
        self._session_id = session_id
        self._client = httpx.AsyncClient(
            base_url=BACKEND_URL,
            headers={"x-internal-secret": INTERNAL_SECRET},
            timeout=10.0,
        )

    # ── Public API ────────────────────────────────────────────────────────────

    async def post_message(self, role: str, content: str) -> None:
        await self._post(
            "/internal/agent/message",
            json={"session_id": self._session_id, "role": role, "content": content},
        )

    async def post_correction(
        self, original: str, corrected: str, explanation: str
    ) -> None:
        await self._post(
            "/internal/agent/correction",
            json={
                "session_id": self._session_id,
                "original_text": original,
                "corrected_text": corrected,
                "explanation": explanation,
            },
        )

    async def notify_session_ended(self) -> None:
        await self._post(
            "/internal/agent/session-ended",
            params={"session_id": self._session_id},
        )
        await self.aclose()

    async def aclose(self) -> None:
        """Close the underlying HTTP connection pool. Call once when the session ends."""
        if not self._client.is_closed:
            await self._client.aclose()
            logger.debug("[%d] BackendClient closed", self._session_id)

    # ── Async context manager support ─────────────────────────────────────────

    async def __aenter__(self) -> "BackendClient":
        return self

    async def __aexit__(self, *_) -> None:
        await self.aclose()

    # ── Internal ──────────────────────────────────────────────────────────────

    async def _post(self, path: str, **kwargs) -> None:
        """POST helper — logs both success and failure."""
        try:
            resp = await self._client.post(path, **kwargs)
            resp.raise_for_status()
            logger.debug("[%d] Backend ✓  POST %s → %d", self._session_id, path, resp.status_code)
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "[%d] Backend ✗  POST %s → HTTP %d  body=%s",
                self._session_id, path, exc.response.status_code, exc.response.text[:200],
            )
        except Exception as exc:
            logger.warning("[%d] Backend ✗  POST %s  error=%s", self._session_id, path, exc)
