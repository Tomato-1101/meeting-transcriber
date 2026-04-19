import { useNavigate } from 'react-router-dom'
import { FileAudio, Clock, Trash2 } from 'lucide-react'
import type { Job } from '../types'

interface Props {
  jobs: Job[]
  onDelete: (id: string) => void
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  processing: 'bg-yellow-100 text-yellow-800',
  transcribing: 'bg-blue-100 text-blue-800',
  uploading: 'bg-gray-100 text-gray-800',
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function JobList({ jobs, onDelete }: Props) {
  const navigate = useNavigate()

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
        <div
          key={job.id}
          className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 hover:border-gray-300 transition-colors cursor-pointer"
          onClick={() => {
            if (job.transcription_id) {
              navigate(`/transcription/${job.transcription_id}`)
            }
          }}
        >
          <FileAudio className="text-gray-400 shrink-0" size={20} />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-800 truncate">
              {job.original_filename}
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(job.duration_seconds)}
              </span>
              <span>{(job.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
              <span>{formatDate(job.created_at)}</span>
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
      ))}
    </div>
  )
}
