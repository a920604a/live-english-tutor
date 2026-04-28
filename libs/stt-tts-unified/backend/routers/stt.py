import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel

from ..services.history_service import history_service
from ..services.whisper_service import whisper_service
from ..utils.file_handler import FileHandler

logger = logging.getLogger(__name__)
router = APIRouter()

file_handler = FileHandler()

ALLOWED_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".flac", ".ogg",
    ".mp4", ".avi", ".mov", ".mkv", ".webm",
}
AVAILABLE_MODELS = ["tiny", "base", "small", "medium", "large"]


class TranscribeRequest(BaseModel):
    file_id: str
    model_size: str = "base"
    language: str = "auto"
    include_timestamps: bool = False


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/models")
async def list_models():
    return JSONResponse(content=AVAILABLE_MODELS)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    from pathlib import Path
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支援的檔案格式: {ext}")

    content = await file.read()
    max_bytes = file_handler.max_file_size
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail="檔案超過大小限制")

    file_id = await file_handler.save_upload(file, content)
    info = await file_handler.get_file_info(file_id)

    return {
        "file_id": file_id,
        "filename": info["filename"],
        "size": info["size"],
        "estimated_processing_time": info["estimated_processing_time"],
    }


@router.post("/transcribe")
async def start_transcribe(req: TranscribeRequest):
    if not await file_handler.file_exists(req.file_id):
        raise HTTPException(status_code=404, detail="檔案不存在")

    if req.model_size not in AVAILABLE_MODELS:
        raise HTTPException(status_code=400, detail="無效的模型")

    asyncio.create_task(
        whisper_service.transcribe(
            file_id=req.file_id,
            model_size=req.model_size,
            language=req.language,
            include_timestamps=req.include_timestamps,
            history_service=history_service,
        )
    )

    return {"success": True, "file_id": req.file_id}


@router.get("/status/{file_id}")
async def get_status(file_id: str):
    return await file_handler.get_processing_status(file_id)


@router.get("/result/{file_id}")
async def get_result(file_id: str):
    try:
        result_path = await file_handler.get_result_file(file_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="結果尚未完成")

    with open(result_path, "r", encoding="utf-8") as f:
        text = f.read()

    words = len(text.split())
    chars = len(text)

    return {
        "text": text,
        "word_count": words,
        "char_count": chars,
    }


@router.get("/download/{file_id}")
async def download_result(file_id: str):
    try:
        result_path = await file_handler.get_result_file(file_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="結果不存在")

    return FileResponse(
        result_path,
        media_type="text/plain",
        filename=f"transcript_{file_id}.txt",
    )


@router.get("/stream/{file_id}")
async def stream_progress(file_id: str):
    """SSE endpoint — pushes status events until completed or error."""

    async def event_generator():
        while True:
            status = await file_handler.get_processing_status(file_id)
            data = json.dumps(status, ensure_ascii=False)
            yield f"data: {data}\n\n"

            if status["status"] in ("completed", "error", "file_not_found"):
                break

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/audio/{filename}")
async def get_stt_audio(filename: str):
    from pathlib import Path
    safe_name = Path(filename).name  # strip path traversal
    path = Path(file_handler.upload_dir) / safe_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="音檔不存在")
    suffix = path.suffix.lower()
    media_types = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".flac": "audio/flac",
        ".ogg": "audio/ogg",
        ".webm": "audio/webm",
        ".mp4": "video/mp4",
    }
    return FileResponse(
        str(path),
        media_type=media_types.get(suffix, "application/octet-stream"),
    )
