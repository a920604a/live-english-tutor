from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.session import TutorSession
from app.models.user import User
from app.schemas.message import MessageOut

router = APIRouter()


@router.get("/{session_id}/messages", response_model=list[MessageOut])
def get_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MessageOut]:
    session = db.query(TutorSession).filter(TutorSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    return session.messages
