import type { JobProgress as JobProgressType } from '../types'

const STAGE_LABELS: Record<string, string> = {
  probing: '音声ファイルを解析中...',
  preprocessing: 'ノイズ低減 + 無音カット中...',
  compressing: '圧縮中...',
  chunking: 'チャンク分割中...',
  transcribing: '文字起こし中...',
  merging: '結果を統合中...',
  saving: '保存中...',
  completed: '完了',
  failed: 'エラー',
}

interface Props {
  progress: JobProgressType
  filename: string
}

export function JobProgressBar({ progress, filename }: Props) {
  const pct = Math.round(progress.progress * 100)
  const label = STAGE_LABELS[progress.stage] || progress.stage

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{filename}</span>
        <span className="text-sm text-gray-500">{pct}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
        <div
          className={`h-3 rounded-full transition-all duration-300 ${
            progress.stage === 'failed' ? 'bg-red-500' : 'bg-blue-600'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        {progress.total_chunks && progress.chunk && (
          <span className="text-sm text-gray-400">
            チャンク {progress.chunk}/{progress.total_chunks}
          </span>
        )}
      </div>
      {progress.error && (
        <p className="mt-2 text-sm text-red-600">{progress.error}</p>
      )}
    </div>
  )
}
