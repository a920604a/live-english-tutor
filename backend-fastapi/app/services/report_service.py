import httpx

from app.config import settings


async def generate_session_report(transcript: str, corrections: list[dict]) -> str:
    """Call Ollama to generate a structured learning report."""
    prompt = _build_report_prompt(transcript, corrections)
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{settings.OLLAMA_BASE_URL}/chat/completions",
            json={
                "model": settings.OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


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
