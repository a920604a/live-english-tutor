import logging
import time

from livekit.agents import tts
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS, APIConnectOptions
from livekit.agents.utils import shortuuid

from backend.services.tts_service import EdgeTTSEngine

logger = logging.getLogger(__name__)


class EdgeTTSPlugin(tts.TTS):
    def __init__(self, *, engine: EdgeTTSEngine, voice: str):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        self._engine = engine
        self._voice = voice

    def synthesize(
        self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS
    ) -> "EdgeTTSChunkedStream":
        return EdgeTTSChunkedStream(tts_plugin=self, input_text=text, conn_options=conn_options)


class EdgeTTSChunkedStream(tts.ChunkedStream):
    def __init__(
        self, *, tts_plugin: EdgeTTSPlugin, input_text: str, conn_options: APIConnectOptions
    ):
        super().__init__(tts=tts_plugin, input_text=input_text, conn_options=conn_options)

    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        output_emitter.initialize(
            request_id=shortuuid(),
            sample_rate=self._tts.sample_rate,
            num_channels=1,
            mime_type="audio/mpeg",
        )

        engine: EdgeTTSEngine = self._tts._engine
        voice: str = self._tts._voice
        chars = len(self._input_text)
        logger.info("TTS[edge] ← chars=%d  voice=%s", chars, voice)
        t0 = time.monotonic()
        total_bytes = 0
        first_chunk = True

        async for chunk in engine.stream_audio(self._input_text, voice):
            if first_chunk:
                logger.info("TTS[edge]  first_chunk=%.2fs", time.monotonic() - t0)
                first_chunk = False
            total_bytes += len(chunk)
            output_emitter.push(chunk)

        output_emitter.flush()
        logger.info("TTS[edge] → total=%.2fs  bytes=%d", time.monotonic() - t0, total_bytes)
