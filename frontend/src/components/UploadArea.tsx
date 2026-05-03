import { useState, useCallback, useMemo } from 'react'
import { Upload, Sparkles, FileAudio, Volume2 } from 'lucide-react'

interface Props {
  onUpload: (file: File, model: string, language?: string, preprocessProfile?: string) => void
  disabled?: boolean
}

const MODELS = [
  {
    id: 'gpt-4o-transcribe',
    name: '最高精度',
    desc: '$0.006/分 — 最高精度・タイムスタンプなし',
    pricePerMin: 0.006,
  },
  {
    id: 'gpt-4o-transcribe-diarize',
    name: '高品質 + 話者分離',
    desc: '$0.006/分 — 話者ラベル＆タイムスタンプ',
    pricePerMin: 0.006,
  },
  {
    id: 'gpt-4o-mini-transcribe',
    name: '低コスト',
    desc: '$0.003/分 — コスト半額・タイムスタンプなし',
    pricePerMin: 0.003,
  },
]

const PROFILES = [
  {
    id: 'standard',
    name: '標準（推奨）',
    desc: 'ノイズ低減 + 無音カット で 10-30% 短縮',
    icon: Sparkles,
    expectedReduction: 0.20,
  },
  {
    id: 'aggressive',
    name: '積極カット',
    desc: '無音の余白を最小化（カットしすぎる可能性あり）',
    icon: Volume2,
    expectedReduction: 0.30,
  },
  {
    id: 'raw',
    name: '前処理なし',
    desc: '元音声のまま（精度最大化、コスト削減なし）',
    icon: FileAudio,
    expectedReduction: 0.0,
  },
]

function estimateAudioMinutes(file: File): number {
  // 多くの音声形式は 1MB ≒ 1 分(64-128kbps) のオーダー。低めに見積もり。
  const mb = file.size / 1024 / 1024
  return mb * 1.0
}

export function UploadArea({ onUpload, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [model, setModel] = useState('')
  const [profile, setProfile] = useState('standard')
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
    onUpload(selectedFile, model, language || undefined, profile)
    setSelectedFile(null)
    setModel('')
  }

  const costEstimate = useMemo(() => {
    if (!selectedFile || !model) return null
    const minutes = estimateAudioMinutes(selectedFile)
    const m = MODELS.find((mm) => mm.id === model)
    if (!m) return null
    const profileObj = PROFILES.find((p) => p.id === profile)
    const reduction = profileObj?.expectedReduction || 0
    const billedMinutes = minutes * (1 - reduction)
    const cost = billedMinutes * m.pricePerMin
    const original = minutes * m.pricePerMin
    return { minutes, billedMinutes, cost, original, reduction }
  }, [selectedFile, model, profile])

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
              文字起こしモデル
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              前処理プロファイル
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PROFILES.map((p) => {
                const Icon = p.icon
                return (
                  <label
                    key={p.id}
                    className={`flex flex-col items-start gap-1 p-3 rounded-lg border cursor-pointer transition-colors ${
                      profile === p.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="profile"
                      value={p.id}
                      checked={profile === p.id}
                      onChange={(e) => setProfile(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                      <Icon size={14} />
                      {p.name}
                    </div>
                    <div className="text-xs text-gray-500">{p.desc}</div>
                  </label>
                )
              })}
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

          {costEstimate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
              <div className="font-medium text-gray-800 mb-1">想定コスト</div>
              <div className="text-gray-600 text-xs leading-relaxed">
                推定 {costEstimate.minutes.toFixed(1)} 分の音声 ・ 課金分数 約{' '}
                {costEstimate.billedMinutes.toFixed(1)} 分 ・{' '}
                <span className="font-medium text-blue-700">
                  ${costEstimate.cost.toFixed(3)}
                </span>
                {costEstimate.reduction > 0 && (
                  <span className="text-green-600 ml-1">
                    （前処理なし比 -${(costEstimate.original - costEstimate.cost).toFixed(3)}）
                  </span>
                )}
                <div className="text-gray-400 mt-1">
                  ※ ファイルサイズからの概算。実際は音声ビットレート次第。
                </div>
              </div>
            </div>
          )}

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
