import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileAudio, Clock, Trash2, Pencil, Check, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { Transcription } from '../types'

interface Props {
  transcriptions: Transcription[]
  onDelete: (id: string) => void
  onRename: (id: string, newName: string) => void
}

function formatDuration(seconds: number): string {
  if (!seconds) return '-'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatRelative(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ja })
  } catch {
    return iso
  }
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP')
}

function Row({
  t,
  onDelete,
  onRename,
}: {
  t: Transcription
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
}) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(t.filename)

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setName(t.filename)
    setEditing(true)
  }

  const cancelEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation()
    setName(t.filename)
    setEditing(false)
  }

  const saveEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation()
    const trimmed = name.trim()
    if (!trimmed || trimmed === t.filename) {
      cancelEdit()
      return
    }
    onRename(t.id, trimmed)
    setEditing(false)
  }

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 hover:border-gray-300 transition-colors group"
      onClick={() => {
        if (editing) return
        navigate(`/transcription/${t.id}`)
      }}
      style={{ cursor: editing ? 'default' : 'pointer' }}
    >
      <FileAudio className="text-gray-400 shrink-0" size={20} />
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit(e)
                else if (e.key === 'Escape') cancelEdit(e)
              }}
              className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
              maxLength={200}
            />
            <button
              onClick={saveEdit}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="保存 (Enter)"
            >
              <Check size={14} />
            </button>
            <button
              onClick={cancelEdit}
              className="p-1 text-gray-500 hover:bg-gray-100 rounded"
              title="キャンセル (Esc)"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="font-medium text-gray-800 truncate flex items-center gap-1.5">
            <span className="truncate">{t.filename}</span>
            <button
              onClick={startEdit}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-600 transition-opacity shrink-0"
              title="名前を変更"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
        <div className="text-sm text-gray-500 flex items-center gap-3 mt-0.5">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {formatDuration(t.duration_seconds)}
          </span>
          <span>{t.segments.length} セグメント</span>
          {t.ai_results.length > 0 && (
            <span>AI {t.ai_results.length} 件</span>
          )}
          <span title={formatAbsolute(t.created_at)}>{formatRelative(t.created_at)}</span>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (confirm(`"${t.filename}" を削除しますか？`)) onDelete(t.id)
        }}
        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
        title="削除"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

export function TranscriptionList({ transcriptions, onDelete, onRename }: Props) {
  if (transcriptions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        まだ文字起こしがありません。<br />
        音声ファイルをアップロードするか、右上の「読み込み」から JSON を読み込んでください。
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {transcriptions.map((t) => (
        <Row key={t.id} t={t} onDelete={onDelete} onRename={onRename} />
      ))}
    </div>
  )
}
