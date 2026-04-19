import { useState } from 'react'
import { Download } from 'lucide-react'
import { exportTranscription } from '../api/client'

interface Props {
  transcriptionId: string
  filename: string
}

export function ExportMenu({ transcriptionId, filename }: Props) {
  const [open, setOpen] = useState(false)

  const handleExport = async (format: 'text' | 'json') => {
    setOpen(false)
    const content = await exportTranscription(transcriptionId, format)
    const ext = format === 'json' ? 'json' : 'txt'
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename.replace(/\.[^.]+$/, '')}_transcription.${ext}`
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
