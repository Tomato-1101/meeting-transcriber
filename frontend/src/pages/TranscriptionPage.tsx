import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, Mic, Pencil, Check, X } from 'lucide-react'
import { TranscriptionView } from '../components/TranscriptionView'
import { AIActionBar } from '../components/AIActionBar'
import { AIResultPanel } from '../components/AIResultPanel'
import { ExportMenu } from '../components/ExportMenu'
import { getTranscription, triggerAI, listAIResults, getJob, renameJob, deleteAIResult } from '../api/client'
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
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)

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
          <div className="min-w-0">
            {editingName && job ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const trimmed = nameDraft.trim()
                      if (!trimmed || trimmed === job.original_filename) {
                        setEditingName(false)
                        return
                      }
                      setSavingName(true)
                      try {
                        const updated = await renameJob(job.id, trimmed)
                        setJob(updated)
                        setEditingName(false)
                      } finally {
                        setSavingName(false)
                      }
                    } else if (e.key === 'Escape') {
                      setEditingName(false)
                    }
                  }}
                  disabled={savingName}
                  maxLength={200}
                  className="text-xl font-bold text-gray-900 px-2 py-0.5 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  onClick={async () => {
                    if (!job) return
                    const trimmed = nameDraft.trim()
                    if (!trimmed || trimmed === job.original_filename) {
                      setEditingName(false)
                      return
                    }
                    setSavingName(true)
                    try {
                      const updated = await renameJob(job.id, trimmed)
                      setJob(updated)
                      setEditingName(false)
                    } finally {
                      setSavingName(false)
                    }
                  }}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  {job?.original_filename || '文字起こし結果'}
                </h1>
                {job && (
                  <button
                    onClick={() => {
                      setNameDraft(job.original_filename)
                      setEditingName(true)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-opacity"
                    title="名前を変更"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
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

      <AIActionBar
        onTrigger={handleAITrigger}
        loading={aiLoading}
        existingResults={aiResults}
        onJumpToResult={(resultType) => {
          const target = aiResults.find((r) => r.result_type === resultType)
          if (!target) return
          const el = document.getElementById(`ai-result-${target.id}`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            el.classList.add('ring-2', 'ring-blue-400')
            setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 1500)
          }
        }}
      />

      <AIResultPanel
        results={aiResults}
        onDelete={async (id) => {
          await deleteAIResult(id)
          setAIResults((prev) => prev.filter((r) => r.id !== id))
        }}
      />
    </div>
  )
}
