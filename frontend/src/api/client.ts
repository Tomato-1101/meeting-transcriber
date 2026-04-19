import type { Job, Transcription, AIResult } from '../types'

const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, options)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }
  return res.json()
}

export async function createJob(file: File, model: string, language?: string): Promise<Job> {
  const form = new FormData()
  form.append('file', file)
  form.append('model', model)
  if (language) form.append('language', language)
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
