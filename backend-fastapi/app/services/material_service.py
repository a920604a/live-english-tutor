import logging
import re
from io import BytesIO
from pathlib import Path
from typing import AsyncIterator

import httpx
from pypdf import PdfReader

from app.config import settings

logger = logging.getLogger(__name__)

MAX_WORDS_PER_CHUNK = 450


def extract_text_from_pdf(pdf_bytes: bytes) -> tuple[str, int]:
    """
    Extract plain text from PDF bytes.
    Returns (full_text, page_count).
    """
    reader = PdfReader(BytesIO(pdf_bytes))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text.strip())
    full_text = "\n\n".join(pages)
    return full_text, len(reader.pages)


def chunk_text(text: str) -> list[str]:
    """
    Split text into chunks of ~MAX_WORDS_PER_CHUNK words,
    breaking at paragraph boundaries where possible.
    """
    # Normalize whitespace
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    if not paragraphs:
        return []

    chunks: list[str] = []
    current_parts: list[str] = []
    current_words = 0

    for para in paragraphs:
        words = len(para.split())
        if current_words + words > MAX_WORDS_PER_CHUNK and current_parts:
            chunks.append(" ".join(current_parts))
            current_parts = [para]
            current_words = words
        else:
            current_parts.append(para)
            current_words += words

    if current_parts:
        chunks.append(" ".join(current_parts))

    return chunks


async def synthesize_chunks(
    chunks: list[str],
    cache_dir: Path,
) -> AsyncIterator[int]:
    """
    Synthesize each chunk via stt-tts-unified TTS, save WAV files to cache_dir.
    Yields the chunk index after each chunk is saved.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient(timeout=120.0) as client:
        for i, chunk_text in enumerate(chunks):
            # 1. Synthesize
            resp = await client.post(
                f"{settings.TTS_SERVICE_URL}/api/tts/synthesize",
                json={"text": chunk_text, "voice": settings.TTS_VOICE},
            )
            resp.raise_for_status()
            audio_relative_url = resp.json()["audio_url"]

            # 2. Download the audio file
            audio_resp = await client.get(
                f"{settings.TTS_SERVICE_URL}{audio_relative_url}"
            )
            audio_resp.raise_for_status()

            # 3. Save to cache
            chunk_path = cache_dir / f"chunk_{i:03d}.wav"
            chunk_path.write_bytes(audio_resp.content)
            logger.info("TTS chunk saved: %s", chunk_path)

            yield i
