import { useState } from 'react'
import FileUpload from './FileUpload'
import Recorder from './Recorder'
import ProgressPoller from './ProgressPoller'
import './STTPanel.css'

type STTTab = 'upload' | 'record'

export default function STTPanel() {
  const [activeTab, setActiveTab] = useState<STTTab>('upload')
  const [fileId, setFileId] = useState<string | null>(null)
  const [modelSize, setModelSize] = useState('base')
  const [language, setLanguage] = useState('auto')
  const [timestamps, setTimestamps] = useState(false)
  const [started, setStarted] = useState(false)

  const handleFileReady = (id: string) => {
    setFileId(id)
    setStarted(false)
  }

  const reset = () => {
    setFileId(null)
    setStarted(false)
  }

  return (
    <div className="stt-panel">
      {/* Tab switcher */}
      <div className="card stt-mode-card">
        <div className="stt-tabs">
          <button
            className={`stt-tab${activeTab === 'upload' ? ' active' : ''}`}
            onClick={() => { setActiveTab('upload'); reset() }}
          >
            📂 上傳音檔
          </button>
          <button
            className={`stt-tab${activeTab === 'record' ? ' active' : ''}`}
            onClick={() => { setActiveTab('record'); reset() }}
          >
            🎙 即時錄音
          </button>
        </div>

        {activeTab === 'upload' ? (
          <FileUpload onFileReady={handleFileReady} />
        ) : (
          <Recorder onFileReady={handleFileReady} />
        )}
      </div>

      {/* Settings */}
      {fileId && !started && (
        <div className="card stt-settings animate-in">
          <h3 className="panel-title">轉換設定</h3>
          <div className="settings-grid">
            <div>
              <label className="field-label" htmlFor="model-select">Whisper 模型</label>
              <select id="model-select" className="select" value={modelSize} onChange={e => setModelSize(e.target.value)}>
                {['tiny', 'base', 'small', 'medium', 'large'].map(m => (
                  <option key={m} value={m}>
                    {m} {m === 'base' ? '（推薦）' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="lang-select">語言</label>
              <select id="lang-select" className="select" value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="auto">自動偵測</option>
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
              </select>
            </div>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" checked={timestamps} onChange={e => setTimestamps(e.target.checked)} />
            包含時間戳記
          </label>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--space-3)' }}
            onClick={() => setStarted(true)}
          >
            開始轉換
          </button>
        </div>
      )}

      {/* Progress & result */}
      {fileId && started && (
        <ProgressPoller
          fileId={fileId}
          modelSize={modelSize}
          language={language}
          includeTimestamps={timestamps}
          onReset={reset}
        />
      )}
    </div>
  )
}
