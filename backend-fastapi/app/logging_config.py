"""
Centralised logging setup for the FastAPI backend.

Call setup_logging() once at application startup (main.py).

Features:
- Coloured human-readable output via colorlog
- request_id injected into every log line (populated by RequestContextMiddleware)
- Third-party noisy loggers silenced to WARNING
- Log level controlled by LOG_LEVEL env var (default: INFO)
"""
import logging
import sys
from contextvars import ContextVar

import colorlog

# Set by RequestContextMiddleware for the duration of each HTTP request.
# Value is accessible anywhere in the same async task chain.
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class _RequestIdFilter(logging.Filter):
    """Inject the current request_id into every LogRecord."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()  # type: ignore[attr-defined]
        return True


def setup_logging(level: str = "INFO") -> None:
    fmt = (
        "%(log_color)s%(asctime)s | %(levelname)-8s%(reset)s"
        " | %(name)-22s | [%(request_id)s] %(message)s"
    )
    handler = colorlog.StreamHandler(sys.stdout)
    handler.setFormatter(
        colorlog.ColoredFormatter(
            fmt=fmt,
            datefmt="%H:%M:%S",
            log_colors={
                "DEBUG":    "white",
                "INFO":     "green",
                "WARNING":  "yellow",
                "ERROR":    "red,bold",
                "CRITICAL": "red,bg_white",
            },
            reset=True,
        )
    )
    handler.addFilter(_RequestIdFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level.upper())
    root.addHandler(handler)

    # uvicorn.access duplicates our middleware logs — silence it.
    logging.getLogger("uvicorn.access").propagate = False

    # Third-party loggers that tend to be very chatty.
    for noisy in ("httpx", "httpcore", "google", "urllib3", "multipart"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
