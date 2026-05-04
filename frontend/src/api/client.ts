import type { Job, Transcription, AIResult, AIPromptInfo, ChatMessage } from '../types'

const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, options)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }
  return res.json()
}

export async function createJob(
  file: File,
  model: string,
  language?: string,
  preprocessProfile?: string,
): Promise<Job> {
  const form = new FormData()
  form.append('file', file)
  form.append('model', model)
  if (language) form.append('language', language)
  if (preprocessProfile) form.append('preprocess_profile', preprocessProfile)
  return request<Job>('/jobs', { method: 'POST', body: form })
}

export async function listJobs(skip = 0, limit = 20): Promise<{ jobs: Job[]; total: number }> {
  return request(`/jobs?skip=${skip}&limit=${limit}`)
}

export async function getJob(jobId: string): Promise<Job> {
  return request(`/jobs/${jobId}`)
}

export async function deleteJob(jobId: string): Promise<void> {
  await fetch(`${BASE}/jobs/${jobId}`, { method: 'DELETE' })
}

export async function renameJob(jobId: string, originalFilename: string): Promise<Job> {
  return request(`/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ original_filename: originalFilename }),
  })
}

export async function getTranscription(id: string): Promise<Transcription> {
  return request(`/transcriptions/${id}`)
}

export async function exportTranscription(id: string, format: 'text' | 'json'): Promise<string> {
  const res = await fetch(`${BASE}/transcriptions/${id}/export?format=${format}`)
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.text()
}

export async function triggerAI(
  transcriptionId: string,
  resultType: string,
  model: string = 'gemini-2.5-flash',
  customPrompt?: string,
): Promise<AIResult> {
  return request(`/transcriptions/${transcriptionId}/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      result_type: resultType,
      model,
      custom_prompt: customPrompt || undefined,
    }),
  })
}

export async function listAIResults(transcriptionId: string): Promise<AIResult[]> {
  return request(`/transcriptions/${transcriptionId}/ai`)
}

export async function deleteAIResult(aiResultId: string): Promise<void> {
  const res = await fetch(`${BASE}/ai-results/${aiResultId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
}

export async function listAIPrompts(): Promise<AIPromptInfo[]> {
  return request('/ai-prompts')
}

export async function listChatMessages(aiResultId: string): Promise<ChatMessage[]> {
  return request(`/ai-results/${aiResultId}/chat`)
}

export async function sendChatMessage(
  aiResultId: string,
  content: string,
  model: string = 'gemini-2.5-flash',
): Promise<{ user: ChatMessage; assistant: ChatMessage }> {
  return request(`/ai-results/${aiResultId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, model }),
  })
}

// Phase 1 限定: 旧 DB の全データを JSON で吐き出す。新仕様への移行が終わったら削除する。
export async function legacyExportAll(): Promise<unknown> {
  const res = await fetch(`${BASE}/admin/export-all`)
  if (!res.ok) throw new Error(`Legacy export failed: ${res.status}`)
  return res.json()
}
