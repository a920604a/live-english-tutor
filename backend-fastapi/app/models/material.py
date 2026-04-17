from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, nullable=False, index=True)   # Firebase UID
    title = Column(String, nullable=False)
    r2_key = Column(String, nullable=False)                 # R2 object key
    page_count = Column(Integer, nullable=True)
    word_count = Column(Integer, nullable=True)
    # tts_status: pending | processing | ready | error
    tts_status = Column(String, nullable=False, default="pending")
    tts_chunk_count = Column(Integer, nullable=True)
    tts_cache_dir = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    listening_sessions = relationship(
        "ListeningSession", back_populates="material", cascade="all, delete-orphan"
    )


class ListeningSession(Base):
    __tablename__ = "listening_sessions"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    user_id = Column(String, nullable=False, index=True)    # Firebase UID
    listened_at = Column(DateTime, server_default=func.now())
    duration_sec = Column(Integer, nullable=False, default=0)
    completed = Column(Boolean, nullable=False, default=False)

    material = relationship("Material", back_populates="listening_sessions")
