import logging
from datetime import datetime, timezone
from typing import Optional

from ..database import get_db

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class HistoryService:
    async def add_tts(
        self,
        text: str,
        voice: str,
        audio_filename: str,
        srt_filename: Optional[str] = None,
    ) -> int:
        async with get_db() as db:
            cursor = await db.execute(
                """
                INSERT INTO tts_history (created_at, text, voice, audio_filename, srt_filename)
                VALUES (?, ?, ?, ?, ?)
                """,
                (_now(), text, voice, audio_filename, srt_filename),
            )
            await db.commit()
            return cursor.lastrowid

    async def add_stt(
        self,
        original_filename: str,
        audio_filename: str,
        transcript: str,
        model_size: str,
        language: str,
        processing_time: float = 0.0,
    ) -> int:
        async with get_db() as db:
            cursor = await db.execute(
                """
                INSERT INTO stt_history
                  (created_at, original_filename, audio_filename, transcript,
                   model_size, language, processing_time)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    _now(),
                    original_filename,
                    audio_filename,
                    transcript,
                    model_size,
                    language,
                    processing_time,
                ),
            )
            await db.commit()
            return cursor.lastrowid

    async def list_all(self, limit: int = 50, offset: int = 0) -> list[dict]:
        async with get_db() as db:
            tts_rows = await db.execute_fetchall(
                """
                SELECT id, created_at, 'tts' AS type, text AS title,
                       voice, audio_filename, srt_filename,
                       NULL AS transcript, NULL AS model_size,
                       NULL AS language, NULL AS processing_time
                FROM tts_history
                """
            )
            stt_rows = await db.execute_fetchall(
                """
                SELECT id, created_at, 'stt' AS type,
                       original_filename AS title,
                       NULL AS voice, audio_filename, NULL AS srt_filename,
                       transcript, model_size, language, processing_time
                FROM stt_history
                """
            )

        combined = [dict(r) for r in tts_rows] + [dict(r) for r in stt_rows]
        combined.sort(key=lambda x: x["created_at"], reverse=True)
        return combined[offset : offset + limit]

    async def list_by_type(self, record_type: str, limit: int = 50, offset: int = 0) -> list[dict]:
        if record_type == "tts":
            table = "tts_history"
            extra = "text AS title, voice, audio_filename, srt_filename, NULL AS transcript, NULL AS model_size, NULL AS language, NULL AS processing_time"
        else:
            table = "stt_history"
            extra = "original_filename AS title, NULL AS voice, audio_filename, NULL AS srt_filename, transcript, model_size, language, processing_time"

        async with get_db() as db:
            rows = await db.execute_fetchall(
                f"SELECT id, created_at, '{record_type}' AS type, {extra} FROM {table} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
        return [dict(r) for r in rows]

    async def delete(self, record_type: str, record_id: int) -> bool:
        from pathlib import Path
        from ..config import get_settings
        settings = get_settings()

        table = "tts_history" if record_type == "tts" else "stt_history"

        async with get_db() as db:
            rows = await db.execute_fetchall(
                f"SELECT * FROM {table} WHERE id = ?", (record_id,)
            )
            if not rows:
                return False
            row = dict(rows[0])

            cursor = await db.execute(f"DELETE FROM {table} WHERE id = ?", (record_id,))
            await db.commit()
            if cursor.rowcount == 0:
                return False

        def _rm(path: Path) -> None:
            try:
                path.unlink(missing_ok=True)
            except Exception as exc:
                logger.warning(f"刪除失敗 {path}: {exc}")

        if record_type == "tts":
            _rm(Path(settings.audio_dir) / row["audio_filename"])
            if row.get("srt_filename"):
                _rm(Path(settings.audio_dir) / row["srt_filename"])
        else:
            audio_filename = row["audio_filename"]
            file_id = Path(audio_filename).stem
            _rm(Path(settings.upload_dir) / audio_filename)
            _rm(Path(settings.upload_dir) / f"{file_id}_metadata.json")
            _rm(Path(settings.upload_dir) / f"{file_id}_status.json")
            _rm(Path(settings.result_dir) / f"{file_id}_text.txt")

        return True


# Singleton
history_service = HistoryService()
