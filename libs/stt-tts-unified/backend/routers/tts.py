import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel

from ..services.history_service import history_service
from ..services.tts_service import tts_service

logger = logging.getLogger(__name__)
router = APIRouter()


class VoiceInfo(BaseModel):
    name: str
    gender: str
    locale: str


class SynthesizeRequest(BaseModel):
    text: str
    voice: VoiceInfo = VoiceInfo(name="zh-TW-YunJheNeural", gender="Male", locale="zh-TW")


@router.get("/voices")
async def list_voices():
    voices = await tts_service.list_voices()
    return JSONResponse(content=voices)


@router.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="請提供文本內容")

    audio_filename, srt_filename = await tts_service.synthesize(req.text, req.voice.name)

    history_id = await history_service.add_tts(
        text=req.text,
        voice=req.voice.name,
        audio_filename=audio_filename,
        srt_filename=srt_filename,
    )

    return {
        "audio_url": f"/api/tts/audio/{audio_filename}",
        "srt_url": f"/api/tts/audio/{srt_filename}",
        "history_id": history_id,
    }


@router.get("/audio/{filename}")
async def get_audio(filename: str):
    path = tts_service.get_audio_path(filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="音檔不存在")

    media_type = "audio/wav" if filename.endswith(".wav") else "text/plain"
    return FileResponse(str(path), media_type=media_type)
