import { useState } from 'react'
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
} from 'lucide-react'

interface Props {
  onTrigger: (resultType: string, model: string, customPrompt?: string) => Promise<void>
  loading: boolean
}

const AI_ACTIONS = [
  { type: 'summary', label: '要約', icon: FileText },
  { type: 'detailed_summary', label: '詳細サマリー', icon: BookOpen },
  { type: 'explanation', label: '解説', icon: HelpCircle },
  { type: 'key_points', label: '要点整理', icon: ListChecks },
  { type: 'decisions', label: '決定事項', icon: CheckSquare },
  { type: 'action_items', label: 'アクションアイテム', icon: Sparkles },
  { type: 'unresolved', label: '未解決事項', icon: AlertTriangle },
  { type: 'reformat', label: 'AI向け整形', icon: Code },
]

const AI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
]

export function AIActionBar({ onTrigger, loading }: Props) {
  const [model, setModel] = useState('gemini-2.5-flash')
  const [showCustom, setShowCustom] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {AI_ACTIONS.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => onTrigger(type, model)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2.5 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 transition-colors border border-gray-200"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
            {label}
          </button>
        ))}
      </div>

      <div>
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
