import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import type { AIResult } from '../types'

interface Props {
  results: AIResult[]
}

const TYPE_LABELS: Record<string, string> = {
  summary: '要約',
  detailed_summary: '詳細サマリー',
  explanation: '解説',
  key_points: '要点整理',
  decisions: '決定事項',
  action_items: 'アクションアイテム',
  unresolved: '未解決事項',
  reformat: 'AI向け整形',
  custom: 'カスタム',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AIResultCard({ result }: { result: AIResult }) {
  const [expanded, setExpanded] = useState(true)
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(result.result_text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">
            {TYPE_LABELS[result.result_type] || result.result_type}
          </span>
          <span className="text-xs text-gray-400">{result.model_used}</span>
          <span className="text-xs text-gray-400">{formatDate(result.created_at)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleCopy} className="p-1 text-gray-400 hover:text-gray-600">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed mt-3">
            {result.result_text}
          </pre>
        </div>
      )}
    </div>
  )
}

export function AIResultPanel({ results }: Props) {
  if (results.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">AI処理結果</h3>
      {results.map((r) => (
        <AIResultCard key={r.id} result={r} />
      ))}
    </div>
  )
}
