// 履歴はクライアント React state にしか存在しない（サーバ側 DB なし）。
// 各 transcription は ai_results を持ち、各 ai_result は chat_messages を持つ「ネスト構造」。
// JSON ダウンロード/ロードはこのネスト構造をそのまま書き出す。

export interface Segment {
  speaker: string | null
  text: string
  start_time: number
  end_time: number
  chunk_index: number
  sequence_order: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  model_used: string | null
  sequence_order: number
  created_at: string
}

export interface AIResult {
  id: string
  result_type: string
  model_used: string
  prompt_used: string
  result_text: string
  created_at: string
  chat_messages: ChatMessage[]
}

export interface Transcription {
  id: string
  filename: string
  full_text: string
  model_used: string
  language_detected: string | null
  duration_seconds: number
  created_at: string
  segments: Segment[]
  ai_results: AIResult[]
}

export interface AIPromptInfo {
  type: string
  label: string
  description: string
  category: 'lecture' | 'meeting' | 'general'
  prompt: string
}

// SSE で受け取る進捗イベント。completed のときは result に最終ペイロードが入る。
export interface TranscribeProgress {
  stage: string
  progress: number
  chunk?: number
  total_chunks?: number
  error?: string
  result?: {
    filename: string
    full_text: string
    segments: Segment[]
    model_used: string
    language_detected: string | null
    duration_seconds: number
  }
}

// JSON ダウンロード/ロードのスキーマ。Phase 1 の legacy export と互換。
export interface HistoryFile {
  version: 1
  transcriptions: Transcription[]
}
