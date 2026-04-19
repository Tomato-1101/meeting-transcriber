import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { Transcription } from '../types'

interface Props {
  transcription: Transcription
}

type ViewMode = 'full' | 'segments'

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const SPEAKER_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

export function TranscriptionView({ transcription }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(
    transcription.segments.length > 0 ? 'segments' : 'full',
  )
  const [copied, setCopied] = useState(false)

  const speakerMap = new Map<string, number>()
  let speakerIdx = 0
  for (const seg of transcription.segments) {
    if (seg.speaker && !speakerMap.has(seg.speaker)) {
      speakerMap.set(seg.speaker, speakerIdx++)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(transcription.full_text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {transcription.segments.length > 0 && (
            <>
              <button
                onClick={() => setViewMode('segments')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  viewMode === 'segments'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                セグメント表示
              </button>
              <button
                onClick={() => setViewMode('full')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  viewMode === 'full'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                全文表示
              </button>
            </>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'コピー済み' : 'コピー'}
        </button>
      </div>

      {viewMode === 'full' ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
            {transcription.full_text}
          </pre>
        </div>
      ) : (
        <div className="space-y-1">
          {transcription.segments.map((seg) => {
            const colorIdx = seg.speaker ? speakerMap.get(seg.speaker) ?? 0 : 0
            const colorClass = SPEAKER_COLORS[colorIdx % SPEAKER_COLORS.length]
            return (
              <div
                key={seg.id}
                className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex gap-3"
              >
                <span className="text-xs text-gray-400 font-mono shrink-0 pt-0.5 w-14 text-right">
                  {formatTime(seg.start_time)}
                </span>
                {seg.speaker && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${colorClass}`}
                  >
                    {seg.speaker}
                  </span>
                )}
                <span className="text-sm text-gray-800">{seg.text}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
