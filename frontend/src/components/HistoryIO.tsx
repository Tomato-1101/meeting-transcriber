import { useRef } from 'react'
import { Download, Upload, Trash2 } from 'lucide-react'
import { useHistory } from '../state/HistoryContext'
import type { HistoryFile, Transcription } from '../types'

// ヘッダーに置く「Download / Load / Clear」ボタン群。
// サーバには何も保存しないので、永続化はユーザーが Download した JSON ファイルが頼り。

function isValidHistoryFile(x: unknown): x is HistoryFile {
  if (!x || typeof x !== 'object') return false
  const obj = x as Record<string, unknown>
  if (obj.version !== 1) return false
  if (!Array.isArray(obj.transcriptions)) return false
  return obj.transcriptions.every((t) => {
    if (!t || typeof t !== 'object') return false
    const tObj = t as Record<string, unknown>
    return typeof tObj.id === 'string' && typeof tObj.full_text === 'string'
  })
}

// レガシー JSON は ai_results / chat_messages が無いことがあるので埋めて Transcription にする。
function normalize(t: Record<string, unknown>): Transcription {
  return {
    id: String(t.id),
    filename: typeof t.filename === 'string' ? t.filename : 'audio',
    full_text: typeof t.full_text === 'string' ? t.full_text : '',
    model_used: typeof t.model_used === 'string' ? t.model_used : '',
    language_detected:
      typeof t.language_detected === 'string' ? t.language_detected : null,
    duration_seconds:
      typeof t.duration_seconds === 'number' ? t.duration_seconds : 0,
    created_at:
      typeof t.created_at === 'string' ? t.created_at : new Date().toISOString(),
    segments: Array.isArray(t.segments) ? (t.segments as Transcription['segments']) : [],
    ai_results: Array.isArray(t.ai_results)
      ? (t.ai_results as Transcription['ai_results']).map((r) => ({
          ...r,
          chat_messages: Array.isArray(r.chat_messages) ? r.chat_messages : [],
        }))
      : [],
  }
}

export function HistoryIO() {
  const { transcriptions, replaceAll, clearAll } = useHistory()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const handleDownload = () => {
    const payload: HistoryFile = { version: 1, transcriptions }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    a.href = url
    a.download = `mt_history_${ts}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoadClick = () => {
    fileRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!isValidHistoryFile(data)) {
        alert('JSON の形式が正しくありません（version: 1 + transcriptions 配列が必要）')
        return
      }
      const next = data.transcriptions.map((t) =>
        normalize(t as unknown as Record<string, unknown>),
      )
      const ok = transcriptions.length === 0
        ? true
        : confirm(
            `現在の履歴 ${transcriptions.length} 件を、ファイルの ${next.length} 件で上書きします。よろしいですか？`,
          )
      if (!ok) return
      replaceAll(next)
    } catch (err) {
      alert(`読み込み失敗: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleClear = () => {
    if (transcriptions.length === 0) return
    if (!confirm(`現在の履歴 ${transcriptions.length} 件を全部消します。よろしいですか？`)) return
    clearAll()
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleDownload}
        disabled={transcriptions.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40"
        title="現在の履歴を JSON ファイルでダウンロード"
      >
        <Download size={14} />
        ダウンロード
      </button>
      <button
        onClick={handleLoadClick}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        title="JSON ファイルから履歴を読み込む（現在の履歴は上書き）"
      >
        <Upload size={14} />
        読み込み
      </button>
      <button
        onClick={handleClear}
        disabled={transcriptions.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors disabled:opacity-40"
        title="履歴を全消去"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
