import { useRef, useState } from 'react'
import { uploadFile } from '../../api/stt'
import './Recorder.css'

interface Props {
  onFileReady: (fileId: string) => void
}

export default function Recorder({ onFileReady }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'uploading' | 'done' | 'error'>('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current!)
        setState('uploading')

        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: mimeType })

        try {
          const result = await uploadFile(file)
          setState('done')
          onFileReady(result.file_id)
        } catch (e: any) {
          setState('error')
          setError(e.message)
        }
      }

      mr.start(250) // collect chunks every 250ms
      mediaRecorderRef.current = mr
      setState('recording')
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch (e: any) {
      setError('無法存取麥克風，請確認已授權')
      setState('error')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
  }

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="recorder">
      {state === 'idle' && (
        <div className="recorder-idle">
          <div className="mic-icon">🎙</div>
          <p className="recorder-hint">點擊下方按鈕開始錄音</p>
          <button className="btn btn-primary" onClick={startRecording}>開始錄音</button>
        </div>
      )}

      {state === 'recording' && (
        <div className="recorder-active">
          <div className="pulse-ring">
            <div className="pulse-dot" />
          </div>
          <p className="recorder-timer">{fmt(duration)}</p>
          <p className="recorder-hint recording">錄音中...</p>
          <button className="btn btn-danger" onClick={stopRecording}>⏹ 停止</button>
        </div>
      )}

      {state === 'uploading' && (
        <div className="recorder-idle">
          <div className="mic-icon">⏳</div>
          <p className="recorder-hint">上傳中...</p>
        </div>
      )}

      {state === 'done' && (
        <div className="recorder-idle">
          <div className="mic-icon">✅</div>
          <p className="recorder-hint">錄音上傳完成（{fmt(duration)}）</p>
        </div>
      )}

      {state === 'error' && (
        <div className="recorder-idle">
          <div className="mic-icon">❌</div>
          <p className="recorder-hint error">{error}</p>
          <button className="btn btn-ghost" onClick={() => setState('idle')}>重試</button>
        </div>
      )}
    </div>
  )
}
