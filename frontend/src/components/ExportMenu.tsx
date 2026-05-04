import { useState } from 'react'
import { Download } from 'lucide-react'
import type { Transcription } from '../types'

interface Props {
  transcription: Transcription
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function exportAsText(t: Transcription): string {
  const lines: string[] = [`# Transcription: ${t.filename}`, '']
  if (t.segments.length > 0) {
    for (const seg of t.segments) {
      const ts = formatTime(seg.start_time)
      const speaker = seg.speaker ? `[${seg.speaker}] ` : ''
      lines.push(`[${ts}] ${speaker}${seg.text}`)
    }
  } else {
    lines.push(t.full_text)
  }
  return lines.join('\n')
}

function exportAsJson(t: Transcription): string {
  return JSON.stringify(
    {
      id: t.id,
      filename: t.filename,
      full_text: t.full_text,
      model_used: t.model_used,
      language_detected: t.language_detected,
      duration_seconds: t.duration_seconds,
      segments: t.segments,
    },
    null,
    2,
  )
}

export function ExportMenu({ transcription }: Props) {
  const [open, setOpen] = useState(false)

  const handleExport = (format: 'text' | 'json') => {
    setOpen(false)
    const content = format === 'json' ? exportAsJson(transcription) : exportAsText(transcription)
    const ext = format === 'json' ? 'json' : 'txt'
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/plain',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const base = transcription.filename.replace(/\.[^.]+$/, '')
    a.href = url
    a.download = `${base}_transcription.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <Download size={14} />
        エクスポート
      </button>
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
            <button
              onClick={() => handleExport('text')}
              className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            >
              テキスト (.txt)
            </button>
            <button
              onClick={() => handleExport('json')}
              className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            >
              JSON (.json)
            </button>
          </div>
        </>
      )}
    </div>
  )
}
