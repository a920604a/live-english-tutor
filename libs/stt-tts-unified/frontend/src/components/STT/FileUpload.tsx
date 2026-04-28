import { useRef, useState } from 'react'
import { uploadFile } from '../../api/stt'
import './FileUpload.css'

interface Props {
  onFileReady: (fileId: string) => void
}

const ALLOWED = '.mp3,.wav,.m4a,.flac,.ogg,.mp4,.avi,.mov,.mkv,.webm'

export default function FileUpload({ onFileReady }: Props) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setUploading(true)
    setFileName(file.name)
    try {
      const result = await uploadFile(file)
      onFileReady(result.file_id)
    } catch (e: any) {
      setError(e.message)
      setFileName(null)
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      className={`drop-zone${dragging ? ' dragging' : ''}${uploading ? ' uploading' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED}
        style={{ display: 'none' }}
        onChange={onInputChange}
      />

      {uploading ? (
        <>
          <span className="drop-icon">⏳</span>
          <p className="drop-title">上傳中...</p>
          <p className="drop-hint">{fileName}</p>
        </>
      ) : fileName ? (
        <>
          <span className="drop-icon">✅</span>
          <p className="drop-title">上傳完成</p>
          <p className="drop-hint">{fileName}</p>
        </>
      ) : (
        <>
          <span className="drop-icon">📁</span>
          <p className="drop-title">拖曳檔案至此，或點擊選擇</p>
          <p className="drop-hint">支援 MP3、WAV、M4A、FLAC、MP4 等格式（最大 500 MB）</p>
        </>
      )}

      {error && <p className="drop-error">{error}</p>}
    </div>
  )
}
