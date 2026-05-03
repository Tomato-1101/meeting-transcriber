import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadArea } from '../components/UploadArea'
import { JobProgressBar } from '../components/JobProgress'
import { JobList } from '../components/JobList'
import { useJobProgress } from '../hooks/useJobProgress'
import { createJob, listJobs, deleteJob } from '../api/client'
import type { Job } from '../types'

export function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeFilename, setActiveFilename] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { progress, reset } = useJobProgress(activeJobId)
  const navigate = useNavigate()

  const loadJobs = useCallback(async () => {
    try {
      const data = await listJobs()
      setJobs(data.jobs)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  useEffect(() => {
    if (progress?.stage === 'completed' && progress.transcription_id) {
      loadJobs()
      setTimeout(() => {
        navigate(`/transcription/${progress.transcription_id}`)
        setActiveJobId(null)
        reset()
      }, 500)
    } else if (progress?.stage === 'failed') {
      loadJobs()
    }
  }, [progress, navigate, loadJobs, reset])

  const handleUpload = async (
    file: File,
    model: string,
    language?: string,
    preprocessProfile?: string,
  ) => {
    setError(null)
    try {
      const job = await createJob(file, model, language, preprocessProfile)
      setActiveJobId(job.id)
      setActiveFilename(file.name)
      loadJobs()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'アップロードに失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    await deleteJob(id)
    loadJobs()
  }

  const handleRename = (id: string, newName: string) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, original_filename: newName } : j)))
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
        <h2 className="text-lg font-medium text-gray-800 mb-4">履歴</h2>
        <JobList jobs={jobs} onDelete={handleDelete} onRename={handleRename} />
      </div>
    </div>
  )
}
