from sqlalchemy import Column, Integer, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class GrammarCorrection(Base):
    __tablename__ = "grammar_corrections"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("tutor_sessions.id"), nullable=False)
    original_text = Column(Text, nullable=False)
    corrected_text = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    session = relationship("TutorSession", back_populates="corrections")
