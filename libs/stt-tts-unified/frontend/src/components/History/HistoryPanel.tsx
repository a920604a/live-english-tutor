import { useEffect, useState } from 'react'
import { listHistory, deleteRecord } from '../../api/history'
import type { HistoryRecord } from '../../api/history'
import HistoryItem from './HistoryItem'
import './HistoryPanel.css'

type Filter = 'all' | 'tts' | 'stt'

export default function HistoryPanel() {
  const [filter, setFilter] = useState<Filter>('all')
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listHistory(filter)
      setRecords(data.records)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  const handleDelete = async (type: 'tts' | 'stt', id: number) => {
    try {
      await deleteRecord(type, id)
      setRecords(prev => prev.filter(r => !(r.type === type && r.id === id)))
    } catch {}
  }

  return (
    <div className="history-panel">
      <div className="history-header card">
        <h2 className="panel-title">歷史紀錄</h2>
        <div className="filter-tabs">
          {(['all', 'tts', 'stt'] as Filter[]).map(f => (
            <button
              key={f}
              className={`filter-tab${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '全部' : f === 'tts' ? '語音合成' : '語音轉文字'}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="history-loading">
          <span className="spinner-dark" />載入中...
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {!loading && records.length === 0 && (
        <div className="history-empty">
          <span className="empty-icon">📭</span>
          <p>尚無紀錄</p>
        </div>
      )}

      <div className="history-list">
        {records.map(r => (
          <HistoryItem
            key={`${r.type}-${r.id}`}
            record={r}
            onDelete={() => handleDelete(r.type, r.id)}
          />
        ))}
      </div>
    </div>
  )
}
