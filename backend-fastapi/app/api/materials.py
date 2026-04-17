import asyncio
import json
import logging
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import AsyncIterator

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.config import settings
from app.models.material import ListeningSession, Material
from app.models.user import User
from app.schemas.material import (
    ListeningSessionCreate,
    ListeningSessionOut,
    MaterialOut,
)
from app.services import material_service, r2_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_owned_material(material_id: int, owner_id: str, db: Session) -> Material:
    m = (
        db.query(Material)
        .filter(Material.id == material_id, Material.owner_id == owner_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")
    return m


def _attach_stats(material: Material, db: Session) -> MaterialOut:
    row = (
        db.query(
            func.count(ListeningSession.id).label("cnt"),
            func.max(ListeningSession.listened_at).label("last_at"),
        )
        .filter(ListeningSession.material_id == material.id)
        .first()
    )
    return MaterialOut(
        id=material.id,
        title=material.title,
        page_count=material.page_count,
        word_count=material.word_count,
        tts_status=material.tts_status,
        tts_chunk_count=material.tts_chunk_count,
        created_at=material.created_at,
        listen_count=row.cnt or 0,
        last_listened_at=row.last_at,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[MaterialOut])
def list_materials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MaterialOut]:
    materials = (
        db.query(Material)
        .filter(Material.owner_id == current_user.firebase_uid)
        .order_by(Material.created_at.desc())
        .all()
    )
    return [_attach_stats(m, db) for m in materials]


@router.post("/", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
async def upload_material(
    file: UploadFile = File(...),
    title: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MaterialOut:
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        if not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    resolved_title = title.strip() or (file.filename or "Untitled").removesuffix(".pdf")
    r2_key = f"materials/{current_user.firebase_uid}/{uuid.uuid4()}.pdf"

    # Upload to R2 in thread pool (boto3 is sync)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, r2_service.upload_pdf, pdf_bytes, r2_key)

    # Quick word count estimate from PDF text
    text, page_count = material_service.extract_text_from_pdf(pdf_bytes)
    word_count = len(text.split())

    material = Material(
        owner_id=current_user.firebase_uid,
        title=resolved_title,
        r2_key=r2_key,
        page_count=page_count,
        word_count=word_count,
        tts_status="pending",
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return _attach_stats(material, db)


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    material = _get_owned_material(material_id, current_user.firebase_uid, db)

    # Delete R2 object
    try:
        r2_service.delete_object(material.r2_key)
    except Exception as exc:
        logger.warning("R2 delete failed for %s: %s", material.r2_key, exc)

    # Delete local TTS cache
    if material.tts_cache_dir:
        cache_dir = Path(material.tts_cache_dir)
        if cache_dir.exists():
            shutil.rmtree(cache_dir, ignore_errors=True)

    db.delete(material)
    db.commit()


@router.get("/{material_id}/prepare")
async def prepare_material_sse(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    material = _get_owned_material(material_id, current_user.firebase_uid, db)

    # Already ready — return immediately
    if material.tts_status == "ready":
        async def _already_ready() -> AsyncIterator[str]:
            yield f"data: {json.dumps({'event': 'done', 'chunk_count': material.tts_chunk_count})}\n\n"
        return StreamingResponse(_already_ready(), media_type="text/event-stream",
                                  headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    # Prevent double-synthesis
    if material.tts_status == "processing":
        async def _already_processing() -> AsyncIterator[str]:
            yield f"data: {json.dumps({'event': 'error', 'message': 'Already processing'})}\n\n"
        return StreamingResponse(_already_processing(), media_type="text/event-stream",
                                  headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    # Capture IDs/values before async context
    mat_id = material.id
    r2_key = material.r2_key

    # Mark processing immediately (before streaming starts)
    material.tts_status = "processing"
    db.commit()

    async def event_stream() -> AsyncIterator[str]:
        try:
            def _sse(data: dict) -> str:
                return f"data: {json.dumps(data)}\n\n"

            yield _sse({"event": "progress", "stage": "downloading", "percent": 5})

            # Download PDF from R2
            loop = asyncio.get_event_loop()
            pdf_bytes: bytes = await loop.run_in_executor(None, r2_service.download_pdf, r2_key)

            yield _sse({"event": "progress", "stage": "extracting", "percent": 20})

            text, _ = material_service.extract_text_from_pdf(pdf_bytes)
            chunks = material_service.chunk_text(text)
            total = len(chunks)

            yield _sse({"event": "progress", "stage": "synthesizing", "percent": 30, "chunk": 0, "total": total})

            cache_dir = Path(settings.TTS_CACHE_DIR) / str(mat_id)

            async for completed_index in material_service.synthesize_chunks(chunks, cache_dir):
                percent = 30 + int(70 * (completed_index + 1) / total)
                yield _sse({
                    "event": "progress",
                    "stage": "synthesizing",
                    "percent": percent,
                    "chunk": completed_index + 1,
                    "total": total,
                })

            # Update DB
            mat = db.query(Material).filter(Material.id == mat_id).first()
            if mat:
                mat.tts_status = "ready"
                mat.tts_chunk_count = total
                mat.tts_cache_dir = str(cache_dir)
                db.commit()

            yield _sse({"event": "done", "chunk_count": total})

        except Exception as exc:
            logger.exception("TTS prepare failed for material %d", mat_id)
            mat = db.query(Material).filter(Material.id == mat_id).first()
            if mat:
                mat.tts_status = "error"
                db.commit()
            yield f"data: {json.dumps({'event': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{material_id}/audio/{chunk_index}")
def get_audio_chunk(
    material_id: int,
    chunk_index: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    material = _get_owned_material(material_id, current_user.firebase_uid, db)
    if material.tts_status != "ready":
        raise HTTPException(status_code=400, detail="Material not ready")
    if not material.tts_cache_dir:
        raise HTTPException(status_code=500, detail="Cache directory not set")

    chunk_path = Path(material.tts_cache_dir) / f"chunk_{chunk_index:03d}.wav"
    if not chunk_path.exists():
        raise HTTPException(status_code=404, detail="Audio chunk not found")

    return FileResponse(str(chunk_path), media_type="audio/wav")


@router.post("/{material_id}/sessions", response_model=ListeningSessionOut,
             status_code=status.HTTP_201_CREATED)
def record_listening_session(
    material_id: int,
    body: ListeningSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ListeningSessionOut:
    _get_owned_material(material_id, current_user.firebase_uid, db)
    session = ListeningSession(
        material_id=material_id,
        user_id=current_user.firebase_uid,
        duration_sec=body.duration_sec,
        completed=body.completed,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/{material_id}/sessions", response_model=list[ListeningSessionOut])
def list_listening_sessions(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ListeningSessionOut]:
    _get_owned_material(material_id, current_user.firebase_uid, db)
    return (
        db.query(ListeningSession)
        .filter(
            ListeningSession.material_id == material_id,
            ListeningSession.user_id == current_user.firebase_uid,
        )
        .order_by(ListeningSession.listened_at.desc())
        .all()
    )
