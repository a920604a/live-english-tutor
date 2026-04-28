import asyncio
import logging
import time
from pathlib import Path
from typing import Optional

import whisper

from ..utils.file_handler import FileHandler

logger = logging.getLogger(__name__)

AVAILABLE_MODELS = ["tiny", "base", "small", "medium", "large"]


class WhisperService:
    def __init__(self):
        self._models: dict[str, whisper.Whisper] = {}
        self.file_handler = FileHandler()

    async def load_model(self, model_size: str) -> whisper.Whisper:
        if model_size in self._models:
            return self._models[model_size]

        logger.info(f"載入 Whisper 模型: {model_size}")
        loop = asyncio.get_event_loop()
        model = await loop.run_in_executor(None, whisper.load_model, model_size)
        self._models[model_size] = model
        logger.info(f"模型 {model_size} 載入完成")
        return model

    async def transcribe(
        self,
        file_id: str,
        model_size: str = "base",
        language: str = "auto",
        include_timestamps: bool = False,
        history_service=None,
    ) -> dict:
        start_time = time.time()

        try:
            await self.file_handler.update_processing_status(
                file_id, "processing", 10, "載入模型", "正在準備 Whisper 模型..."
            )

            model = await self.load_model(model_size)
            file_path = await self.file_handler.get_file_path(file_id)

            await self.file_handler.update_processing_status(
                file_id, "processing", 40, "語音識別", "正在轉換音頻..."
            )

            language_param: Optional[str] = None if language == "auto" else language
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: model.transcribe(str(file_path), language=language_param),
            )

            processing_time = time.time() - start_time

            if include_timestamps and "segments" in result:
                lines = [
                    f"[{self._fmt(seg['start'])} - {self._fmt(seg['end'])}] {seg['text'].strip()}"
                    for seg in result["segments"]
                ]
                output_text = "\n".join(lines)
            else:
                output_text = result["text"].strip()

            from ..config import get_settings
            settings = get_settings()
            result_path = Path(settings.result_dir) / f"{file_id}_text.txt"
            result_path.write_text(output_text, encoding="utf-8")

            await self.file_handler.update_processing_status(
                file_id, "completed", 100, "完成", "轉換完成",
                processing_time=processing_time,
            )

            # Insert history record
            if history_service is not None:
                original_filename = await self.file_handler.get_original_filename(file_id)
                stored_filename = await self.file_handler.get_stored_filename(file_id)
                await history_service.add_stt(
                    original_filename=original_filename,
                    audio_filename=stored_filename,
                    transcript=output_text,
                    model_size=model_size,
                    language=language,
                    processing_time=processing_time,
                )

            logger.info(f"轉換完成 {file_id}: {processing_time:.1f}s")
            return {
                "text": output_text,
                "processing_time": processing_time,
                "segments": result.get("segments", []) if include_timestamps else [],
            }

        except Exception as e:
            logger.error(f"轉換失敗 {file_id}: {e}")
            await self.file_handler.update_processing_status(
                file_id, "error", 0, "錯誤", str(e)
            )
            raise

    @staticmethod
    def _fmt(seconds: float) -> str:
        m, s = divmod(int(seconds), 60)
        return f"{m:02d}:{s:02d}"


# Singleton
whisper_service = WhisperService()
