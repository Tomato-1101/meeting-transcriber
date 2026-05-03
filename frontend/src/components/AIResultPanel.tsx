import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Check, Trash2, MessageSquare, Eye, FileCode } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AIResult } from '../types'
import { AIResultChat } from './AIResultChat'

interface Props {
  results: AIResult[]
  onDelete: (id: string) => Promise<void> | void
}

const TYPE_LABELS: Record<string, string> = {
  lecture_notes: '授業ノート（章立て）',
  lecture_qa: '授業Q&A',
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

function AIResultCard({ result, onDelete }: { result: AIResult; onDelete: (id: string) => Promise<void> | void }) {
  const [expanded, setExpanded] = useState(true)
  const [copied, setCopied] = useState(false)
  const [renderMarkdown, setRenderMarkdown] = useState(true)
  const [showChat, setShowChat] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(result.result_text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('この結果を削除しますか？同じプロンプトで再実行できるようになります。')) return
    await onDelete(result.id)
  }

  return (
    <div
      id={`ai-result-${result.id}`}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all"
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-800 truncate">
            {TYPE_LABELS[result.result_type] || result.result_type}
          </span>
          <span className="text-xs text-gray-400 shrink-0">{result.model_used}</span>
          <span className="text-xs text-gray-400 shrink-0">{formatDate(result.created_at)}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setRenderMarkdown((v) => !v)
            }}
            className="p-1 text-gray-400 hover:text-gray-600"
            title={renderMarkdown ? '原文(Markdown)を表示' : 'プレビューを表示'}
          >
            {renderMarkdown ? <FileCode size={14} /> : <Eye size={14} />}
          </button>
          <button onClick={handleCopy} className="p-1 text-gray-400 hover:text-gray-600" title="コピー">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowChat((v) => !v)
            }}
            className={`p-1 ${showChat ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            title="この結果について質問"
          >
            <MessageSquare size={14} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-gray-400 hover:text-red-500"
            title="削除（同じプロンプトを再実行可能になる）"
          >
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {renderMarkdown ? (
            <div className="prose prose-sm max-w-none mt-3 text-gray-800 leading-relaxed
              prose-headings:font-bold prose-headings:text-gray-900
              prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
              prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
              prose-code:text-pink-600 prose-code:bg-pink-50 prose-code:px-1 prose-code:rounded
              prose-pre:bg-gray-50 prose-pre:text-gray-800
              prose-blockquote:border-blue-300 prose-blockquote:text-gray-600">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.result_text}
              </ReactMarkdown>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed mt-3">
              {result.result_text}
            </pre>
          )}
          {showChat && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <AIResultChat aiResultId={result.id} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AIResultPanel({ results, onDelete }: Props) {
  if (results.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">AI処理結果</h3>
      {results.map((r) => (
        <AIResultCard key={r.id} result={r} onDelete={onDelete} />
      ))}
    </div>
  )
}
