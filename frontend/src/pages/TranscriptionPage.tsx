import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, Mic, Pencil, Check, X } from 'lucide-react'
import { TranscriptionView } from '../components/TranscriptionView'
import { AIActionBar } from '../components/AIActionBar'
import { AIResultPanel } from '../components/AIResultPanel'
import { ExportMenu } from '../components/ExportMenu'
import { runAI } from '../api/client'
import { useHistory } from '../state/HistoryContext'
import type { AIResult } from '../types'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}分${s}秒`
}

export function TranscriptionPage() {
  const { id } = useParams<{ id: string }>()
  const { transcriptions, renameTranscription, addAIResult, deleteAIResult } = useHistory()
  const transcription = transcriptions.find((t) => t.id === id)

  const [aiLoading, setAILoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const handleAITrigger = async (resultType: string, model: string, customPrompt?: string) => {
    if (!transcription) return
    setAILoading(true)
    setError(null)
    try {
      const { result_text, prompt_used } = await runAI(
        transcription.full_text,
        resultType,
        model,
        customPrompt,
      )
      const newResult: AIResult = {
        id: crypto.randomUUID(),
        result_type: resultType,
        model_used: model,
        prompt_used,
        result_text,
        created_at: new Date().toISOString(),
        chat_messages: [],
      }
      addAIResult(transcription.id, newResult)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI処理に失敗しました')
    } finally {
      setAILoading(false)
    }
  }

  if (!transcription) {
    return (
      <div className="space-y-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> 履歴一覧に戻る
        </Link>
        <div className="text-center py-12 text-gray-500 text-sm">
          この URL の文字起こしは見つかりませんでした。<br />
          リロードや別ブラウザでの再アクセスでは、サーバ側に履歴が無いので消えます。<br />
          右上の「読み込み」で JSON を読み込むと復元できます。
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = nameDraft.trim()
                      if (trimmed && trimmed !== transcription.filename) {
                        renameTranscription(transcription.id, trimmed)
                      }
                      setEditingName(false)
                    } else if (e.key === 'Escape') {
                      setEditingName(false)
                    }
                  }}
                  maxLength={200}
                  className="text-xl font-bold text-gray-900 px-2 py-0.5 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  onClick={() => {
                    const trimmed = nameDraft.trim()
                    if (trimmed && trimmed !== transcription.filename) {
                      renameTranscription(transcription.id, trimmed)
                    }
                    setEditingName(false)
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
                <h1 className="text-xl font-bold text-gray-900 truncate">{transcription.filename}</h1>
                <button
                  onClick={() => {
                    setNameDraft(transcription.filename)
                    setEditingName(true)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-opacity"
                  title="名前を変更"
                >
                  <Pencil size={14} />
                </button>
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
        <ExportMenu transcription={transcription} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
      )}

      <TranscriptionView transcription={transcription} />

      <AIActionBar
        onTrigger={handleAITrigger}
        loading={aiLoading}
        existingResults={transcription.ai_results}
        onJumpToResult={(resultType) => {
          const target = transcription.ai_results.find((r) => r.result_type === resultType)
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
        transcription={transcription}
        onDelete={(aiResultId) => deleteAIResult(transcription.id, aiResultId)}
      />
    </div>
  )
}
