import httpx

from app.config import settings


async def generate_session_report(transcript: str, corrections: list[dict]) -> str:
    """Call Google Gemini to generate a structured learning report."""
    if not settings.GOOGLE_API_KEY:
        raise RuntimeError("GOOGLE_API_KEY is not set — cannot generate report")

    prompt = _build_report_prompt(transcript, corrections)

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models"
            f"/{settings.GOOGLE_REPORT_MODEL}:generateContent",
            params={"key": settings.GOOGLE_API_KEY},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
            },
        )
        response.raise_for_status()

    return response.json()["candidates"][0]["content"]["parts"][0]["text"]


def _build_report_prompt(transcript: str, corrections: list[dict]) -> str:
    correction_text = "\n".join(
        f"- Original: \"{c['original_text']}\"\n  Corrected: \"{c['corrected_text']}\"\n  Note: {c.get('explanation', '')}"
        for c in corrections
    )
    return f"""You are an English language tutor generating a structured lesson report.

## Conversation Transcript
{transcript}

## Grammar Corrections Made
{correction_text or "None"}

Please generate a concise learning report in Traditional Chinese with the following sections:
1. 課程摘要（2-3 句話）
2. 表現亮點（2-3 點）
3. 需要加強的地方（2-3 點）
4. 本次新單字或句型
5. 下次練習建議

Keep it encouraging and specific."""
