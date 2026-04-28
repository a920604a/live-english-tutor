from datetime import datetime

from pydantic import BaseModel


class MessageCreate(BaseModel):
    session_id: int
    role: str  # "student" | "tutor"
    content: str


class MessageOut(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}
