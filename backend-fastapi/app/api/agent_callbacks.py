from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.config import settings
from app.models.correction import GrammarCorrection
from app.models.message import ConversationMessage
from app.models.session import SessionStatus, TutorSession
from app.schemas.message import MessageCreate
from app.schemas.session import CorrectionCreate

router = APIRouter()


def _verify_internal_secret(x_internal_secret: str = Header(...)) -> None:
    if x_internal_secret != settings.INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/agent/message", dependencies=[Depends(_verify_internal_secret)])
def receive_message(body: MessageCreate, db: Session = Depends(get_db)):
    msg = ConversationMessage(
        session_id=body.session_id,
        role=body.role,
        content=body.content,
    )
    db.add(msg)
    db.commit()
    return {"ok": True}


@router.post("/agent/correction", dependencies=[Depends(_verify_internal_secret)])
def receive_correction(body: CorrectionCreate, db: Session = Depends(get_db)):
    correction = GrammarCorrection(
        session_id=body.session_id,
        original_text=body.original_text,
        corrected_text=body.corrected_text,
        explanation=body.explanation,
    )
    db.add(correction)
    db.commit()
    return {"ok": True}


@router.post("/agent/session-ended", dependencies=[Depends(_verify_internal_secret)])
def agent_session_ended(session_id: int, db: Session = Depends(get_db)):
    session = db.query(TutorSession).filter(TutorSession.id == session_id).first()
    if session and session.status != SessionStatus.ENDED:
        session.status = SessionStatus.ENDED
        session.ended_at = datetime.now(timezone.utc)
        db.commit()
    return {"ok": True}
