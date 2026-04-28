from contextlib import asynccontextmanager
from typing import AsyncIterator

import aiosqlite

from .config import get_settings

_settings = get_settings()


@asynccontextmanager
async def get_db() -> AsyncIterator[aiosqlite.Connection]:
    async with aiosqlite.connect(_settings.db_path) as db:
        db.row_factory = aiosqlite.Row
        yield db


async def init_db() -> None:
    async with aiosqlite.connect(_settings.db_path) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS tts_history (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at     TEXT    NOT NULL,
                text           TEXT    NOT NULL,
                voice          TEXT    NOT NULL,
                audio_filename TEXT    NOT NULL,
                srt_filename   TEXT
            );

            CREATE TABLE IF NOT EXISTS stt_history (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at        TEXT    NOT NULL,
                original_filename TEXT    NOT NULL,
                audio_filename    TEXT    NOT NULL,
                transcript        TEXT    NOT NULL,
                model_size        TEXT    NOT NULL,
                language          TEXT    NOT NULL,
                processing_time   REAL
            );
        """)
        await db.commit()
