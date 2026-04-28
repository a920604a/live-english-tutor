import asyncio
import io
import logging
import os
from datetime import datetime
from pathlib import Path

import edge_tts
from edge_tts.exceptions import NoAudioReceived

from ..config import get_settings

logger = logging.getLogger(__name__)

_settings = get_settings()

AVAILABLE_VOICES_CACHE: list[dict] | None = None


class TTSService:
    def __init__(self):
        self.audio_dir = Path(_settings.audio_dir)
        self.audio_dir.mkdir(parents=True, exist_ok=True)

    async def list_voices(self) -> list[dict]:
        global AVAILABLE_VOICES_CACHE
        if AVAILABLE_VOICES_CACHE is None:
            voices = await edge_tts.list_voices()
            AVAILABLE_VOICES_CACHE = [
                {"name": v["Name"], "gender": v["Gender"], "locale": v["Locale"]}
                for v in voices
            ]
        return AVAILABLE_VOICES_CACHE

    async def synthesize(self, text: str, voice: str) -> tuple[str, str]:
        """
        Synthesize text to WAV + SRT.
        Returns (audio_filename, srt_filename).
        """
        text = text.strip()

        audio_bytes = b""
        submaker = edge_tts.SubMaker()
        last_exc: Exception | None = None

        for attempt in range(3):
            if attempt > 0:
                await asyncio.sleep(attempt * 2)
                logger.warning(f"TTS retry {attempt}/2 for voice={voice}")
            try:
                communicate = edge_tts.Communicate(text, voice)
                submaker = edge_tts.SubMaker()
                with io.BytesIO() as buf:
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            buf.write(chunk["data"])
                        elif chunk["type"] == "WordBoundary":
                            submaker.feed(chunk)
                    audio_bytes = buf.getvalue()
                break
            except NoAudioReceived as exc:
                last_exc = exc
        else:
            raise last_exc

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        audio_filename = f"tts_{timestamp}.wav"
        srt_filename = f"tts_{timestamp}.srt"

        (self.audio_dir / audio_filename).write_bytes(audio_bytes)
        (self.audio_dir / srt_filename).write_text(submaker.get_srt(), encoding="utf-8")

        logger.info(f"TTS 合成完成: {audio_filename}")
        return audio_filename, srt_filename

    def get_audio_path(self, filename: str) -> Path:
        return self.audio_dir / filename


# Singleton
tts_service = TTSService()
