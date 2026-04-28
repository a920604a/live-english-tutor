import { useEffect, useRef, useState } from 'react'
import { startTranscribe, openProgressStream, getResult, downloadUrl } from '../../api/stt'
import type { StatusResult, TranscriptResult } from '../../api/stt'
import './ProgressPoller.css'

interface Props {
  fileId: string
  modelSize: string
  language: string
  includeTimestamps: boolean
  onReset: () => void
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

function notifyDone() {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification('語音轉文字完成！', {
      body: '點擊返回頁面查看結果',
      icon: '/favicon.ico',
    })
  }
}

export default function ProgressPoller({ fileId, modelSize, language, includeTimestamps, onReset }: Props) {
  const [status, setStatus] = useState<StatusResult | null>(null)
  const [result, setResult] = useState<TranscriptResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    requestNotificationPermission()

    const run = async () => {
      try {
        await startTranscribe(fileId, modelSize, language, includeTimestamps)
      } catch (e: any) {
        setError(e.message)
        return
      }

      const es = openProgressStream(fileId)
      esRef.current = es

      es.onmessage = async (event) => {
        const s: StatusResult = JSON.parse(event.data)
        setStatus(s)

        if (s.status === 'completed') {
          es.close()
          notifyDone()
          try {
            const r = await getResult(fileId)
            setResult(r)
          } catch {
            setError('無法取得結果')
          }
        } else if (s.status === 'error' || s.status === 'file_not_found') {
          es.close()
          setError(s.message || '轉換失敗')
        }
      }

      es.onerror = () => {
        es.close()
        setError('連線中斷，請重新嘗試')
      }
    }

    run()
    return () => { esRef.current?.close() }
  }, [fileId])

  const progress = status?.progress ?? 0

  return (
    <div className="poller">
      {!result && !error && (
        <div className="card poller-card animate-in">
          <div className="poller-header">
            <p className="poller-stage">{status?.stage ?? '準備中'}</p>
            <span className="poller-pct">{progress}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="poller-message">{status?.message ?? '正在啟動...'}</p>
        </div>
      )}

      {error && (
        <div className="card poller-card animate-in">
          <div className="poller-error">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
          <button className="btn btn-ghost" onClick={onReset}>重新開始</button>
        </div>
      )}

      {result && (
        <div className="card result-card animate-in">
          <div className="result-stats">
            <div className="stat">
              <span className="stat-value">{result.word_count}</span>
              <span className="stat-label">詞數</span>
            </div>
            <div className="stat">
              <span className="stat-value">{result.char_count}</span>
              <span className="stat-label">字數</span>
            </div>
            {status?.processing_time && (
              <div className="stat">
                <span className="stat-value">{status.processing_time.toFixed(1)}s</span>
                <span className="stat-label">耗時</span>
              </div>
            )}
          </div>
          <textarea className="textarea result-textarea" readOnly value={result.text} rows={10} />
          <div className="result-actions">
            <a href={downloadUrl(fileId)} download className="btn btn-primary">下載文字檔</a>
            <button className="btn btn-ghost" onClick={onReset}>再轉一個</button>
          </div>
        </div>
      )}
    </div>
  )
}
