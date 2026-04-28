import { useState } from 'react'
import { useTheme } from '../../context/ThemeContext'
import TTSPanel from '../TTS/TTSPanel'
import STTPanel from '../STT/STTPanel'
import HistoryPanel from '../History/HistoryPanel'
import './AppShell.css'

type Tab = 'tts' | 'stt' | 'history'

export default function AppShell() {
  const { theme, toggleTheme } = useTheme()
  const [tab, setTab] = useState<Tab>('tts')

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-title">
            <span className="app-title-icon">🎙</span>
            <span>STT &amp; TTS</span>
          </div>

          <nav className="tab-nav">
            {(['tts', 'stt', 'history'] as Tab[]).map(t => (
              <button
                key={t}
                className={`tab-btn${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'tts' ? '文字轉語音' : t === 'stt' ? '語音轉文字' : '歷史紀錄'}
              </button>
            ))}
          </nav>

          <button
            className="theme-btn"
            onClick={toggleTheme}
            aria-label="切換主題"
            title={theme === 'light' ? '切換深色模式' : '切換淺色模式'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="app-content animate-in">
          {tab === 'tts' && <TTSPanel />}
          {tab === 'stt' && <STTPanel />}
          {tab === 'history' && <HistoryPanel />}
        </div>
      </main>
    </div>
  )
}
