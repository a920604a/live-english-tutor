from datetime import datetime

from pydantic import BaseModel

from app.models.session import SessionStatus


class SessionCreate(BaseModel):
    topic: str


class SessionOut(BaseModel):
    id: int
    room_name: str
    topic: str
    status: SessionStatus
    report_text: str | None
    created_at: datetime
    ended_at: datetime | None

    model_config = {"from_attributes": True}


class LiveKitTokenOut(BaseModel):
    token: str
    url: str


class CorrectionCreate(BaseModel):
    session_id: int
    original_text: str
    corrected_text: str
    explanation: str | None = None
