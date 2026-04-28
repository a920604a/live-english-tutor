import { useState } from 'react'
import type { HistoryRecord } from '../../api/history'
import './HistoryItem.css'

interface Props {
  record: HistoryRecord
  onDelete: () => void
}

export default function HistoryItem({ record, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)

  const date = new Date(record.created_at).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  const isTTS = record.type === 'tts'

  return (
    <div className="history-item card animate-in">
      <div className="history-item-header" onClick={() => setExpanded(!expanded)}>
        <div className="history-item-meta">
          <span className={`type-badge ${record.type}`}>
            {isTTS ? 'TTS' : 'STT'}
          </span>
          <span className="history-date">{date}</span>
        </div>
        <div className="history-title-row">
          <p className="history-title">{record.title}</p>
          <button className="expand-btn" aria-label="展開">{expanded ? '▲' : '▼'}</button>
        </div>
        {isTTS && record.voice && (
          <p className="history-sub">{record.voice}</p>
        )}
        {!isTTS && record.model_size && (
          <p className="history-sub">{record.model_size} · {record.language} {record.processing_time ? `· ${record.processing_time.toFixed(1)}s` : ''}</p>
        )}
      </div>

      {expanded && (
        <div className="history-item-body">
          {isTTS && record.audio_filename && (
            <audio controls src={`/api/tts/audio/${record.audio_filename}`} className="history-audio" />
          )}
          {!isTTS && record.audio_filename && (
            <audio controls src={`/api/stt/audio/${record.audio_filename}`} className="history-audio" />
          )}
          {!isTTS && record.transcript && (
            <div className="transcript-preview">
              <p className="transcript-text">{record.transcript}</p>
            </div>
          )}
          <div className="history-actions">
            {isTTS && record.audio_filename && (
              <a href={`/api/tts/audio/${record.audio_filename}`} download className="btn btn-ghost btn-sm">
                下載音檔
              </a>
            )}
            {!isTTS && record.audio_filename && (
              <a href={`/api/stt/audio/${record.audio_filename}`} download className="btn btn-ghost btn-sm">
                下載音檔
              </a>
            )}
            <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); onDelete() }}>
              刪除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
