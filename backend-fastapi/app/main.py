import os

import app.firebase_app  # noqa: F401 — initialize Firebase Admin SDK at startup

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.api import auth, sessions, messages, agent_callbacks
from app.logging_config import setup_logging
from app.middleware import RequestContextMiddleware

setup_logging(level=os.getenv("LOG_LEVEL", "INFO"))

# Allowed origins: all localhost ports for dev + Cloudflare Pages domain for production.
# Add your *.pages.dev (or custom) domain here after deploying to Cloudflare Pages.
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
    # "https://your-project.pages.dev",  # <-- uncomment and fill in after CF Pages deploy
]


def create_app() -> FastAPI:
    # Auto-create tables on startup
    Base.metadata.create_all(bind=engine)

    app = FastAPI(title="Live English Tutor API", version="0.1.0")

    # Middleware is LIFO: RequestContext runs first (outermost), CORS runs inside it.
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
    app.include_router(messages.router, prefix="/sessions", tags=["messages"])
    app.include_router(agent_callbacks.router, prefix="/internal", tags=["internal"])

    return app


app = create_app()
