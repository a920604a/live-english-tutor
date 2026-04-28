import enum

from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class SessionStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    ENDED = "ended"


class TutorSession(Base):
    __tablename__ = "tutor_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    room_name = Column(String, unique=True, nullable=False)  # "session-{id}"
    topic = Column(String, nullable=False)
    status = Column(Enum(SessionStatus), default=SessionStatus.PENDING, nullable=False)
    report_text = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    ended_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="sessions")
    messages = relationship("ConversationMessage", back_populates="session", cascade="all, delete-orphan")
    corrections = relationship("GrammarCorrection", back_populates="session", cascade="all, delete-orphan")
