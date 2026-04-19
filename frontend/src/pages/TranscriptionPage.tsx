import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, Mic } from 'lucide-react'
import { TranscriptionView } from '../components/TranscriptionView'
import { AIActionBar } from '../components/AIActionBar'
import { AIResultPanel } from '../components/AIResultPanel'
import { ExportMenu } from '../components/ExportMenu'
import { getTranscription, triggerAI, listAIResults, getJob } from '../api/client'
import type { Transcription, AIResult, Job } from '../types'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}分${s}秒`
}

export function TranscriptionPage() {
  const { id } = useParams<{ id: string }>()
  const [transcription, setTranscription] = useState<Transcription | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [aiResults, setAIResults] = useState<AIResult[]>([])
  const [aiLoading, setAILoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const t = await getTranscription(id)
      setTranscription(t)
      const j = await getJob(t.job_id)
      setJob(j)
      const results = await listAIResults(id)
      setAIResults(results)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'データの読み込みに失敗しました')
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAITrigger = async (resultType: string, model: string, customPrompt?: string) => {
    if (!id) return
    setAILoading(true)
    try {
      await triggerAI(id, resultType, model, customPrompt)
      const results = await listAIResults(id)
      setAIResults(results)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI処理に失敗しました')
    } finally {
      setAILoading(false)
    }
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
        {error}
      </div>
    )
  }

  if (!transcription) {
    return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {job?.original_filename || '文字起こし結果'}
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(transcription.duration_seconds)}
              </span>
              <span className="flex items-center gap-1">
                <Mic size={12} />
                {transcription.model_used}
              </span>
              {transcription.language_detected && (
                <span>言語: {transcription.language_detected}</span>
              )}
              <span>{transcription.segments.length} セグメント</span>
            </div>
          </div>
        </div>
        <ExportMenu
          transcriptionId={transcription.id}
          filename={job?.original_filename || 'transcription'}
        />
      </div>

      <TranscriptionView transcription={transcription} />

      <AIActionBar onTrigger={handleAITrigger} loading={aiLoading} />

      <AIResultPanel results={aiResults} />
    </div>
  )
}
