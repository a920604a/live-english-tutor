import logging
import os
import tempfile
import time
import uuid
import wave

from livekit.agents import stt, utils
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS, NOT_GIVEN, APIConnectOptions, NotGivenOr

from backend.services.whisper_service import WhisperEngine

logger = logging.getLogger(__name__)


class WhisperSTT(stt.STT):
    def __init__(self, *, engine: WhisperEngine, language: str = "auto"):
        super().__init__(
            capabilities=stt.STTCapabilities(streaming=False, interim_results=False)
        )
        self._engine = engine
        self._language = language

    async def _recognize_impl(
        self,
        buffer: utils.AudioBuffer,
        *,
        language: NotGivenOr[str] = NOT_GIVEN,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
    ) -> stt.SpeechEvent:
        merged = utils.combine_frames(buffer)
        lang = language if utils.is_given(language) else self._language

        # int16 PCM → duration in seconds
        audio_dur = len(merged.data) / 2 / merged.sample_rate / merged.num_channels
        logger.info("STT ← audio=%.2fs  sample_rate=%d", audio_dur, merged.sample_rate)
        t0 = time.monotonic()

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                tmp_path = f.name

            with wave.open(tmp_path, "wb") as wf:
                wf.setnchannels(merged.num_channels)
                wf.setsampwidth(2)  # int16 = 2 bytes per sample
                wf.setframerate(merged.sample_rate)
                wf.writeframes(bytes(merged.data))

            result = await self._engine.transcribe(
                tmp_path,
                model_size=self._engine.default_model,
                language=lang,
                include_timestamps=False,
            )
            text = result.get("text", "").strip()
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

        logger.info("STT → elapsed=%.2fs  text=%r", time.monotonic() - t0, text)

        lang_code = lang if lang != "auto" else "en"
        return stt.SpeechEvent(
            type=stt.SpeechEventType.FINAL_TRANSCRIPT,
            request_id=str(uuid.uuid4())[:8],
            alternatives=[stt.SpeechData(language=lang_code, text=text)],
        )
