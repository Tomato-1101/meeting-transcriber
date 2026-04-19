import { useState, useEffect, useCallback } from 'react'
import type { JobProgress } from '../types'

export function useJobProgress(jobId: string | null) {
  const [progress, setProgress] = useState<JobProgress | null>(null)

  useEffect(() => {
    if (!jobId) return

    const eventSource = new EventSource(`/api/jobs/${jobId}/stream`)

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data) as JobProgress
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
