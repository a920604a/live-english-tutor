export interface HistoryRecord {
  id: number
  created_at: string
  type: 'tts' | 'stt'
  title: string
  // TTS fields
  voice?: string
  audio_filename?: string
  srt_filename?: string
  // STT fields
  transcript?: string
  model_size?: string
  language?: string
  processing_time?: number
}

export interface HistoryResponse {
  records: HistoryRecord[]
  total: number
}

export async function listHistory(
  type: 'all' | 'tts' | 'stt' = 'all',
  limit = 50,
  offset = 0,
): Promise<HistoryResponse> {
  const res = await fetch(`/api/history?type=${type}&limit=${limit}&offset=${offset}`)
  if (!res.ok) throw new Error('無法取得歷史紀錄')
  return res.json()
}

export async function deleteRecord(type: 'tts' | 'stt', id: number): Promise<void> {
  const res = await fetch(`/api/history/${type}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('刪除失敗')
}
