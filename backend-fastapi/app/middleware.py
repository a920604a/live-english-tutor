"""
RequestContextMiddleware

For every HTTP request:
  1. Generates a short request_id (8-char hex) and stores it in a ContextVar
     so all log calls within the same async task chain include it automatically.
  2. Logs the incoming request  → METHOD PATH
  3. Logs the outgoing response ← METHOD PATH STATUS  <ms>ms
  4. Attaches X-Request-ID header to the response (useful in browser devtools).
"""
import logging
import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.logging_config import request_id_var

logger = logging.getLogger(__name__)


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        rid = uuid4().hex[:8]
        token = request_id_var.set(rid)
        start = time.perf_counter()

        logger.info("→ %s %s", request.method, request.url.path)

        try:
            response: Response = await call_next(request)
            ms = int((time.perf_counter() - start) * 1000)
            log = logger.error if response.status_code >= 500 else logger.info
            log("← %s %s %d  %dms", request.method, request.url.path, response.status_code, ms)
            response.headers["X-Request-ID"] = rid
            return response
        except Exception:
            ms = int((time.perf_counter() - start) * 1000)
            logger.exception("← %s %s ERR  %dms", request.method, request.url.path, ms)
            raise
        finally:
            request_id_var.reset(token)
