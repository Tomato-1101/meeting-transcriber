import { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  ListChecks,
  CheckSquare,
  HelpCircle,
  BookOpen,
  AlertTriangle,
  Code,
  Sparkles,
  Loader2,
  Info,
  Check,
  GraduationCap,
  MessageCircleQuestion,
} from 'lucide-react'
import { listAIPrompts } from '../api/client'
import type { AIPromptInfo, AIResult } from '../types'

interface Props {
  onTrigger: (resultType: string, model: string, customPrompt?: string) => Promise<void>
  loading: boolean
  existingResults: AIResult[]
  onJumpToResult: (resultType: string) => void
}

const ICONS: Record<string, typeof FileText> = {
  lecture_notes: GraduationCap,
  lecture_qa: MessageCircleQuestion,
  summary: FileText,
  detailed_summary: BookOpen,
  explanation: HelpCircle,
  key_points: ListChecks,
  decisions: CheckSquare,
  action_items: Sparkles,
  unresolved: AlertTriangle,
  reformat: Code,
}

const CATEGORY_LABELS: Record<string, string> = {
  lecture: '授業向け',
  meeting: '会議向け',
  general: '汎用',
}
const CATEGORY_ORDER: Array<'lecture' | 'meeting' | 'general'> = ['lecture', 'meeting', 'general']

const AI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
]

const MODEL_STORAGE_KEY = 'ai_action_bar_model'

export function AIActionBar({ onTrigger, loading, existingResults, onJumpToResult }: Props) {
  const [model, setModel] = useState(() => {
    if (typeof window === 'undefined') return 'gemini-2.5-flash'
    return localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-2.5-flash'
  })
  const [showCustom, setShowCustom] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [prompts, setPrompts] = useState<AIPromptInfo[]>([])
  const [expandedType, setExpandedType] = useState<string | null>(null)

  useEffect(() => {
    listAIPrompts().then(setPrompts).catch(() => setPrompts([]))
  }, [])

  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE_KEY, model)
  }, [model])

  const doneTypes = useMemo(
    () => new Set(existingResults.map((r) => r.result_type)),
    [existingResults],
  )

  const grouped = useMemo(() => {
    const map: Record<string, AIPromptInfo[]> = { lecture: [], meeting: [], general: [] }
    for (const p of prompts) {
      if (map[p.category]) map[p.category].push(p)
      else map.general.push(p)
    }
    return map
  }, [prompts])

  const handleClick = (p: AIPromptInfo) => {
    if (loading) return
    if (doneTypes.has(p.type)) {
      onJumpToResult(p.type)
      return
    }
    onTrigger(p.type, model)
  }

  const handlePreviewToggle = (type: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedType((cur) => (cur === type ? null : type))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">AI処理</h3>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1"
        >
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const items = grouped[category]
        if (!items || items.length === 0) return null
        return (
          <div key={category} className="mb-4 last:mb-2">
            <div className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
              {CATEGORY_LABELS[category]}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {items.map((p) => {
                const Icon = ICONS[p.type] || Sparkles
                const done = doneTypes.has(p.type)
                const isExpanded = expandedType === p.type
                return (
                  <div key={p.type} className="contents">
                    <div className="relative">
                      <button
                        onClick={() => handleClick(p)}
                        disabled={loading}
                        title={done ? '処理済み（クリックで結果へジャンプ）' : p.description}
                        className={`w-full flex items-center justify-between gap-1.5 px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                          done
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-blue-50 hover:text-blue-700'
                        } disabled:opacity-50`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          {loading && !done ? (
                            <Loader2 size={14} className="animate-spin shrink-0" />
                          ) : done ? (
                            <Check size={14} className="shrink-0" />
                          ) : (
                            <Icon size={14} className="shrink-0" />
                          )}
                          <span className="truncate">{p.label}</span>
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handlePreviewToggle(p.type, e)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation()
                              setExpandedType((cur) => (cur === p.type ? null : p.type))
                            }
                          }}
                          className={`shrink-0 p-0.5 rounded hover:bg-white/60 transition-colors ${
                            isExpanded ? 'text-blue-600' : 'text-gray-400'
                          }`}
                          aria-label="プロンプト本文を表示"
                        >
                          <Info size={12} />
                        </span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {expandedType && items.some((p) => p.type === expandedType) && (
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1.5">
                  プロンプト本文 — <span className="font-medium text-gray-700">
                    {items.find((p) => p.type === expandedType)?.label}
                  </span>
                </div>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                  {items.find((p) => p.type === expandedType)?.prompt}
                </pre>
              </div>
            )}
          </div>
        )
      })}

      <div className="pt-3 border-t border-gray-100">
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {showCustom ? 'カスタムプロンプトを閉じる' : 'カスタムプロンプトで実行...'}
        </button>
        {showCustom && (
          <div className="mt-2 space-y-2">
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="文字起こしに対して実行したい処理を記述..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-24 resize-none"
            />
            <button
              onClick={() => {
                if (customPrompt.trim()) {
                  onTrigger('custom', model, customPrompt)
                }
              }}
              disabled={loading || !customPrompt.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              実行
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
