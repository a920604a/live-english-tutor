import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.config import settings
from app.models.session import SessionStatus, TutorSession
from app.models.user import User
from app.schemas.session import LiveKitTokenOut, SessionCreate, SessionOut
from app.services.livekit_service import generate_token
from app.services.report_service import generate_session_report

router = APIRouter()


@router.post("/", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    body: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionOut:
    room_name = f"session-placeholder"  # placeholder; updated after insert
    session = TutorSession(
        user_id=current_user.id,
        room_name=room_name,
        topic=body.topic,
        status=SessionStatus.PENDING,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    # Update room_name now that we have the id
    session.room_name = f"session-{session.id}"
    db.commit()
    db.refresh(session)
    return session


@router.get("/", response_model=list[SessionOut])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SessionOut]:
    return (
        db.query(TutorSession)
        .filter(TutorSession.user_id == current_user.id)
        .order_by(TutorSession.created_at.desc())
        .all()
    )


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionOut:
    session = _get_owned_session(session_id, current_user.id, db)
    return session


@router.post("/{session_id}/token", response_model=LiveKitTokenOut)
def get_livekit_token(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveKitTokenOut:
    session = _get_owned_session(session_id, current_user.id, db)
    if session.status == SessionStatus.ENDED:
        raise HTTPException(status_code=400, detail="Session already ended")
    session.status = SessionStatus.ACTIVE
    db.commit()
    token = generate_token(
        room_name=session.room_name,
        participant_identity=f"user-{current_user.id}",
        participant_name=current_user.full_name or current_user.email,
    )
    return LiveKitTokenOut(token=token, url=settings.LIVEKIT_URL)


@router.post("/{session_id}/end", response_model=SessionOut)
def end_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionOut:
    session = _get_owned_session(session_id, current_user.id, db)
    if session.status == SessionStatus.ENDED:
        return session
    session.status = SessionStatus.ENDED
    session.ended_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(session)
    background_tasks.add_task(_generate_report, session_id, db)
    return session


@router.get("/{session_id}/report")
def get_report(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_owned_session(session_id, current_user.id, db)
    if session.report_text is None:
        return {"status": "pending", "report": None}
    return {"status": "ready", "report": session.report_text}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_owned_session(session_id: int, user_id: int, db: Session) -> TutorSession:
    session = db.query(TutorSession).filter(TutorSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your session")
    return session


async def _generate_report(session_id: int, db: Session) -> None:
    session = db.query(TutorSession).filter(TutorSession.id == session_id).first()
    if not session:
        return
    transcript = "\n".join(
        f"[{m.role.upper()}] {m.content}" for m in session.messages
    )
    corrections = [
        {
            "original_text": c.original_text,
            "corrected_text": c.corrected_text,
            "explanation": c.explanation,
        }
        for c in session.corrections
    ]
    try:
        report = await generate_session_report(transcript, corrections)
        session.report_text = report
        db.commit()
    except Exception:
        pass  # report generation is best-effort
