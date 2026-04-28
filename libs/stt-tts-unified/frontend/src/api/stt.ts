export interface UploadResult {
  file_id: string
  filename: string
  size: number
  estimated_processing_time: number
}

export interface StatusResult {
  status: 'processing' | 'completed' | 'error' | 'file_not_found'
  progress: number
  stage: string
  message: string
  processing_time?: number
}

export interface TranscriptResult {
  text: string
  word_count: number
  char_count: number
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/stt/upload', { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? '上傳失敗')
  }
  return res.json()
}

export async function startTranscribe(
  file_id: string,
  model_size: string,
  language: string,
  include_timestamps: boolean,
): Promise<void> {
  const res = await fetch('/api/stt/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id, model_size, language, include_timestamps }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? '啟動轉換失敗')
  }
}

export async function getStatus(file_id: string): Promise<StatusResult> {
  const res = await fetch(`/api/stt/status/${file_id}`)
  return res.json()
}

export async function getResult(file_id: string): Promise<TranscriptResult> {
  const res = await fetch(`/api/stt/result/${file_id}`)
  if (!res.ok) throw new Error('結果尚未完成')
  return res.json()
}

export function downloadUrl(file_id: string): string {
  return `/api/stt/download/${file_id}`
}

export function openProgressStream(file_id: string): EventSource {
  return new EventSource(`/api/stt/stream/${file_id}`)
}
