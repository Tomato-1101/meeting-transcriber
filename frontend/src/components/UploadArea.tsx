import { useState, useCallback } from 'react'
import { Upload } from 'lucide-react'

interface Props {
  onUpload: (file: File, model: string, language?: string) => void
  disabled?: boolean
}

const MODELS = [
  {
    id: 'gpt-4o-transcribe',
    name: 'Highest Accuracy (最高精度)',
    desc: '$0.006/分 - 最高精度テキスト変換・タイムスタンプなし',
  },
  {
    id: 'gpt-4o-transcribe-diarize',
    name: 'High Quality + 話者分離',
    desc: '$0.006/分 - 話者ラベル・タイムスタンプ付き',
  },
  {
    id: 'gpt-4o-mini-transcribe',
    name: 'Standard (低コスト)',
    desc: '$0.003/分 - コスト半額・タイムスタンプなし',
  },
]

export function UploadArea({ onUpload, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [model, setModel] = useState('')
  const [language, setLanguage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFile = useCallback((file: File) => {
    setSelectedFile(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleSubmit = () => {
    if (!selectedFile || !model) return
    onUpload(selectedFile, model, language || undefined)
    setSelectedFile(null)
    setModel('')
  }

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (disabled) return
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'audio/*,.mp3,.wav,.m4a,.mp4,.webm,.ogg,.flac'
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) handleFile(file)
          }
          input.click()
        }}
      >
        <Upload className="mx-auto mb-3 text-gray-400" size={40} />
        {selectedFile ? (
          <div>
            <p className="text-lg font-medium text-gray-800">{selectedFile.name}</p>
            <p className="text-sm text-gray-500">
              {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
        ) : (
          <div>
            <p className="text-lg text-gray-600">
              録音ファイルをドラッグ&ドロップ
            </p>
            <p className="text-sm text-gray-400 mt-1">
              または クリックして選択 (MP3, WAV, M4A, etc.)
            </p>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              文字起こしモデルを選択
            </label>
            <div className="space-y-2">
              {MODELS.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    model === m.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={m.id}
                    checked={model === m.id}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-800">{m.name}</div>
                    <div className="text-sm text-gray-500">{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              言語 (空欄で自動検出)
            </label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="ja, en, etc."
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!model}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            文字起こしを開始
          </button>
        </div>
      )}
    </div>
  )
}
