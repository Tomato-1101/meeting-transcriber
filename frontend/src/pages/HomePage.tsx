import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadArea } from '../components/UploadArea'
import { JobProgressBar } from '../components/JobProgress'
import { TranscriptionList } from '../components/TranscriptionList'
import { useJobProgress } from '../hooks/useJobProgress'
import { startTranscribe } from '../api/client'
import { useHistory } from '../state/HistoryContext'
import type { Transcription } from '../types'

export function HomePage() {
  const { transcriptions, addTranscription, renameTranscription, deleteTranscription } = useHistory()
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeFilename, setActiveFilename] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { progress, reset } = useJobProgress(activeJobId)
  const navigate = useNavigate()
  const handledRef = useRef<string | null>(null)

  useEffect(() => {
    // 完了/失敗イベントは 1 ジョブにつき 1 回だけ処理する
    if (!progress || !activeJobId) return
    if (handledRef.current === activeJobId) return
    if (progress.stage === 'completed' && progress.result) {
      handledRef.current = activeJobId
      const r = progress.result
      const transcription: Transcription = {
        id: crypto.randomUUID(),
        filename: r.filename,
        full_text: r.full_text,
        model_used: r.model_used,
        language_detected: r.language_detected,
        duration_seconds: r.duration_seconds,
        created_at: new Date().toISOString(),
        segments: r.segments,
        ai_results: [],
      }
      addTranscription(transcription)
      setTimeout(() => {
        setActiveJobId(null)
        reset()
        navigate(`/transcription/${transcription.id}`)
      }, 400)
    } else if (progress.stage === 'failed') {
      handledRef.current = activeJobId
      setError(progress.error || '文字起こしに失敗しました')
    }
  }, [progress, activeJobId, addTranscription, navigate, reset])

  const handleUpload = async (
    file: File,
    model: string,
    language?: string,
    preprocessProfile?: string,
  ) => {
    setError(null)
    try {
      const { job_id, filename } = await startTranscribe(file, model, language, preprocessProfile)
      setActiveJobId(job_id)
      setActiveFilename(filename || file.name)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'アップロードに失敗しました')
    }
  }

  return (
    <div className="space-y-8">
      <UploadArea onUpload={handleUpload} disabled={!!activeJobId} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {activeJobId && progress && (
        <JobProgressBar progress={progress} filename={activeFilename} />
      )}

      <div>
        <h2 className="text-lg font-medium text-gray-800 mb-2">履歴</h2>
        <p className="text-xs text-gray-500 mb-4">
          ※ サーバには何も保存されません。ブラウザを閉じると履歴は消えます。残したい場合は右上の「ダウンロード」で JSON 保存し、次回「読み込み」で復元してください。
        </p>
        <TranscriptionList
          transcriptions={transcriptions}
          onRename={renameTranscription}
          onDelete={deleteTranscription}
        />
      </div>
    </div>
  )
}
