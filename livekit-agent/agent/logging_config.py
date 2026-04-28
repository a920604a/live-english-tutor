"""
Centralised logging setup for the LiveKit agent worker.

Call setup_logging() once at process startup (main.py, before load_dotenv side-effects).

Features:
- Coloured human-readable output via colorlog
- Third-party / livekit noisy loggers silenced to WARNING
- Log level controlled by LOG_LEVEL env var (default: INFO)
"""
import logging
import sys

import colorlog


def setup_logging(level: str = "INFO") -> None:
    fmt = (
        "%(log_color)s%(asctime)s | %(levelname)-8s%(reset)s"
        " | %(name)-26s | %(message)s"
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

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level.upper())
    root.addHandler(handler)

    # Silence truly noisy third-party loggers; keep livekit.agents at INFO
    # so worker connection / job lifecycle messages remain visible.
    for noisy in ("httpx", "httpcore", "google", "urllib3", "asyncio",
                  "livekit.rtc", "opentelemetry"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
