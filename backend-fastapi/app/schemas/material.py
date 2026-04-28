from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MaterialCreate(BaseModel):
    title: str


class MaterialOut(BaseModel):
    id: int
    title: str
    page_count: Optional[int]
    word_count: Optional[int]
    tts_status: str
    tts_chunk_count: Optional[int]
    created_at: datetime
    listen_count: int = 0
    last_listened_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MaterialPlaybackChunk(BaseModel):
    index: int
    text: str


class MaterialPlaybackOut(BaseModel):
    id: int
    title: str
    full_text: str
    chunks: list[MaterialPlaybackChunk]


class ListeningSessionCreate(BaseModel):
    duration_sec: int
    completed: bool


class ListeningSessionOut(BaseModel):
    id: int
    material_id: int
    listened_at: datetime
    duration_sec: int
    completed: bool

    model_config = {"from_attributes": True}
