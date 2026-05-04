// ステートレス API クライアント。
// サーバに何も保存させないので「取得系」エンドポイントは無い。処理依頼の 3 つだけ。

import type { AIPromptInfo } from '../types'

const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, options)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }
  return res.json()
}

// 文字起こし開始 (multipart)。返るのは job_id（SSE 用）と filename だけ。
// 進捗・結果は GET /api/transcribe/{job_id}/stream の SSE で取得。
export async function startTranscribe(
  file: File,
  model: string,
  language?: string,
  preprocessProfile?: string,
): Promise<{ job_id: string; filename: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('model', model)
  if (language) form.append('language', language)
  if (preprocessProfile) form.append('preprocess_profile', preprocessProfile)
  return request('/transcribe', { method: 'POST', body: form })
}

// AI 処理。クライアントが transcription 全文を毎回送る。
export async function runAI(
  fullText: string,
  resultType: string,
  model = 'gemini-2.5-flash',
  customPrompt?: string,
): Promise<{ result_text: string; prompt_used: string }> {
  return request('/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_text: fullText,
      result_type: resultType,
      model,
      custom_prompt: customPrompt || undefined,
    }),
  })
}

// チャット。クライアントが文脈（transcription + ai_result + history）を毎回送る。
export async function sendChat(args: {
  transcriptionText: string
  aiResultText: string
  aiResultType: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  userMessage: string
  model: string
}): Promise<{ content: string }> {
  return request('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcription_text: args.transcriptionText,
      ai_result_text: args.aiResultText,
      ai_result_type: args.aiResultType,
      history: args.history,
      user_message: args.userMessage,
      model: args.model,
    }),
  })
}

// プロンプトテンプレート一覧（DB 不要、純粋データ）。
export async function listAIPrompts(): Promise<AIPromptInfo[]> {
  return request('/ai-prompts')
}
