import { useEffect, useRef, useState } from 'react'
import { listVoices, synthesize } from '../../api/tts'
import type { Voice } from '../../api/tts'
import { detectLocalePrefix } from '../../utils/detectLocale'
import './TTSPanel.css'

export default function TTSPanel() {
  const [voices, setVoices] = useState<Voice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null)
  const [detectedLocale, setDetectedLocale] = useState('zh')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    listVoices()
      .then(loaded => {
        setVoices(loaded)
        const def = loaded.find(v => v.name === 'zh-TW-YunJheNeural') ?? loaded[0] ?? null
        setSelectedVoice(def)
      })
      .catch(() => setError('無法載入語音列表'))
  }, [])

  // Debounced language detection
  useEffect(() => {
    const timer = setTimeout(() => {
      setDetectedLocale(detectLocalePrefix(text))
    }, 500)
    return () => clearTimeout(timer)
  }, [text])

  // Auto-switch voice when detected locale changes
  useEffect(() => {
    if (voices.length === 0) return
    const filtered = voices.filter(v => v.locale.startsWith(detectedLocale))
    if (filtered.length === 0) return
    if (!selectedVoice || !filtered.find(v => v.name === selectedVoice.name)) {
      setSelectedVoice(filtered[0])
    }
  }, [detectedLocale, voices])

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch(() => {})
    }
  }, [audioUrl])

  const handleSynthesize = async () => {
    if (!text.trim() || !selectedVoice) return
    setLoading(true)
    setError(null)
    setAudioUrl(null)
    try {
      const result = await synthesize(text, selectedVoice)
      setAudioUrl(result.audio_url)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredVoices = voices.filter(v => v.locale.startsWith(detectedLocale))

  return (
    <div className="tts-panel">
      <div className="card tts-card">
        <h2 className="panel-title">文字轉語音</h2>
        <p className="panel-desc">輸入文字，選擇語音，即可生成音訊</p>

        <div className="separator" />

        <label className="field-label" htmlFor="tts-text">輸入文字</label>
        <textarea
          id="tts-text"
          className="textarea"
          placeholder="請輸入要合成的文字..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSynthesize()
          }}
          rows={5}
        />
        <p className="char-count">{text.length} 字</p>

        <label className="field-label" htmlFor="voice-select" style={{ marginTop: 'var(--space-4)' }}>
          選擇語音
        </label>
        <select
          id="voice-select"
          className="select"
          value={selectedVoice?.name ?? ''}
          onChange={e => setSelectedVoice(filteredVoices.find(v => v.name === e.target.value) ?? null)}
        >
          {filteredVoices.map(v => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.locale} · {v.gender})
            </option>
          ))}
        </select>

        {error && <div className="alert alert-error">{error}</div>}

        <button
          className="btn btn-primary tts-submit"
          onClick={handleSynthesize}
          disabled={loading || !text.trim() || !selectedVoice}
        >
          {loading ? (
            <><span className="spinner" />合成中...</>
          ) : (
            '▶ 開始合成'
          )}
        </button>
        <p className="hint">⌘ + Enter 快捷鍵</p>
      </div>

      {audioUrl && (
        <div className="card audio-result animate-in">
          <h3 className="result-title">合成結果</h3>
          <audio ref={audioRef} controls src={audioUrl} className="audio-player" />
          <div className="audio-actions">
            <a href={audioUrl} download className="btn btn-ghost">下載音檔</a>
          </div>
        </div>
      )}
    </div>
  )
}
