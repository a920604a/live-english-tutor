export interface Voice {
  name: string
  gender: string
  locale: string
}

export interface SynthesizeResult {
  audio_url: string
  srt_url: string
  history_id: number
}

export async function listVoices(): Promise<Voice[]> {
  const res = await fetch('/api/tts/voices')
  if (!res.ok) throw new Error('無法取得語音列表')
  return res.json()
}

export async function synthesize(text: string, voice: Voice): Promise<SynthesizeResult> {
  const res = await fetch('/api/tts/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? '合成失敗')
  }
  return res.json()
}
