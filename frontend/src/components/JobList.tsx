import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileAudio, Clock, Trash2, Pencil, Check, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { Job } from '../types'
import { renameJob } from '../api/client'

interface Props {
  jobs: Job[]
  onDelete: (id: string) => void
  onRename: (id: string, newName: string) => void
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  processing: 'bg-blue-100 text-blue-800 animate-pulse',
  transcribing: 'bg-blue-100 text-blue-800 animate-pulse',
  chunking: 'bg-blue-100 text-blue-800 animate-pulse',
  merging: 'bg-blue-100 text-blue-800 animate-pulse',
  uploading: 'bg-gray-100 text-gray-800',
  pending: 'bg-gray-100 text-gray-800',
}

const STATUS_LABELS: Record<string, string> = {
  completed: '完了',
  failed: 'エラー',
  processing: '処理中',
  transcribing: '文字起こし中',
  uploading: 'アップロード中',
  chunking: 'チャンク分割中',
  merging: '統合中',
  pending: '待機中',
}

function formatDuration(seconds: number | null): string {
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

function JobRow({ job, onDelete, onRename }: { job: Job; onDelete: (id: string) => void; onRename: (id: string, name: string) => void }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(job.original_filename)
  const [saving, setSaving] = useState(false)

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setName(job.original_filename)
    setEditing(true)
  }

  const cancelEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation()
    setName(job.original_filename)
    setEditing(false)
  }

  const saveEdit = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation()
    const trimmed = name.trim()
    if (!trimmed || trimmed === job.original_filename) {
      cancelEdit()
      return
    }
    setSaving(true)
    try {
      await renameJob(job.id, trimmed)
      onRename(job.id, trimmed)
      setEditing(false)
    } catch {
      // keep editing on error
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 hover:border-gray-300 transition-colors group"
      onClick={() => {
        if (editing) return
        if (job.transcription_id) {
          navigate(`/transcription/${job.transcription_id}`)
        }
      }}
      style={{ cursor: editing ? 'default' : job.transcription_id ? 'pointer' : 'default' }}
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
              disabled={saving}
              className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
              maxLength={200}
            />
            <button
              onClick={saveEdit}
              disabled={saving}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="保存 (Enter)"
            >
              <Check size={14} />
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="p-1 text-gray-500 hover:bg-gray-100 rounded"
              title="キャンセル (Esc)"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="font-medium text-gray-800 truncate flex items-center gap-1.5">
            <span className="truncate">{job.original_filename}</span>
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
            {formatDuration(job.duration_seconds)}
          </span>
          <span>{(job.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
          <span title={formatAbsolute(job.created_at)}>{formatRelative(job.created_at)}</span>
        </div>
      </div>
      <span
        className={`text-xs px-2 py-1 rounded-full font-medium ${
          STATUS_STYLES[job.status] || 'bg-gray-100 text-gray-600'
        }`}
      >
        {STATUS_LABELS[job.status] || job.status}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(job.id)
        }}
        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
        title="削除"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

export function JobList({ jobs, onDelete, onRename }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        まだ文字起こしがありません
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} onDelete={onDelete} onRename={onRename} />
      ))}
    </div>
  )
}
