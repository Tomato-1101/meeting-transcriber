import { useState, useEffect, useCallback } from 'react'
import type { TranscribeProgress } from '../types'

// 文字起こしジョブの進捗を SSE で受け取るフック。
// stage="completed" のイベントには result（full_text+segments+meta）が入る。
// クライアントはそこから transcription を組み立てて context に追加する。
export function useJobProgress(jobId: string | null) {
  const [progress, setProgress] = useState<TranscribeProgress | null>(null)

  useEffect(() => {
    if (!jobId) return

    const eventSource = new EventSource(`/api/transcribe/${jobId}/stream`)

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data) as TranscribeProgress
      setProgress(data)
      if (data.stage === 'completed' || data.stage === 'failed') {
        eventSource.close()
      }
    })

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => eventSource.close()
  }, [jobId])

  const reset = useCallback(() => setProgress(null), [])

  return { progress, reset }
}
