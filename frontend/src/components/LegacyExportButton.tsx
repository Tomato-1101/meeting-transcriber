import { useState } from 'react'
import { Download } from 'lucide-react'
import { legacyExportAll } from '../api/client'

// Phase 1 限定: 旧 DB の全文字起こし + AI 結果 + chat を JSON で書き出す。
// 新仕様（クライアント保存）に移行したら、このコンポーネントごと削除する。
export function LegacyExportButton() {
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    setBusy(true)
    try {
      const data = await legacyExportAll()
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `mt_legacy_${ts}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`Legacy export failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50"
      title="旧データを JSON で書き出す（Phase 1 限定。移行後は削除）"
    >
      <Download size={14} />
      {busy ? '書き出し中…' : 'Download all (legacy)'}
    </button>
  )
}
