import asyncio
import logging
import time

from livekit.agents import tts
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS, APIConnectOptions
from livekit.agents.utils import shortuuid

from backend.services.kokoro_service import KokoroEngine

logger = logging.getLogger(__name__)


class KokoroTTSPlugin(tts.TTS):
    def __init__(self, *, engine: KokoroEngine, voice: str = "af_heart"):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        self._engine = engine
        self._voice = voice

    def synthesize(
        self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS
    ) -> "KokoroChunkedStream":
        return KokoroChunkedStream(tts_plugin=self, input_text=text, conn_options=conn_options)

    def prewarm(self) -> None:
        # Trigger ONNX model load synchronously during worker startup to avoid
        # first-utterance latency. _run_inference is a blocking call; prewarm()
        # is invoked before the async loop starts handling sessions.
        try:
            self._engine._run_inference(".", self._voice)
        except Exception:
            pass


class KokoroChunkedStream(tts.ChunkedStream):
    def __init__(
        self, *, tts_plugin: KokoroTTSPlugin, input_text: str, conn_options: APIConnectOptions
    ):
        super().__init__(tts=tts_plugin, input_text=input_text, conn_options=conn_options)

    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        output_emitter.initialize(
            request_id=shortuuid(),
            sample_rate=24000,
            num_channels=1,
            mime_type="audio/pcm",
        )

        engine: KokoroEngine = self._tts._engine
        voice: str = self._tts._voice
        chars = len(self._input_text)
        logger.info("TTS[kokoro] ← chars=%d  voice=%s", chars, voice)
        t0 = time.monotonic()

        loop = asyncio.get_event_loop()
        samples, _ = await loop.run_in_executor(
            None, engine._run_inference, self._input_text, voice
        )
        pcm_bytes = KokoroEngine._samples_to_pcm_int16(samples)
        logger.info("TTS[kokoro] → infer=%.2fs  bytes=%d", time.monotonic() - t0, len(pcm_bytes))
        output_emitter.push(pcm_bytes)
        output_emitter.flush()
