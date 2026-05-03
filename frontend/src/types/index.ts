export interface Job {
  id: string
  status: string
  original_filename: string
  file_size_bytes: number
  duration_seconds: number | null
  model: string
  language: string | null
  num_chunks: number | null
  progress: number
  error_message: string | null
  created_at: string
  updated_at: string
  transcription_id: string | null
}

export interface Segment {
  id: string
  speaker: string | null
  text: string
  start_time: number
  end_time: number
  sequence_order: number
}

export interface Transcription {
  id: string
  job_id: string
  full_text: string
  model_used: string
  language_detected: string | null
  duration_seconds: number
  created_at: string
  segments: Segment[]
}

export interface AIResult {
  id: string
  transcription_id: string
  result_type: string
  model_used: string
  result_text: string
  created_at: string
}

export interface AIPromptInfo {
  type: string
  label: string
  description: string
  category: 'lecture' | 'meeting' | 'general'
  prompt: string
}

export interface ChatMessage {
  id: string
  ai_result_id: string
  role: 'user' | 'assistant'
  content: string
  model_used: string | null
  created_at: string
  sequence_order: number
}

export interface JobProgress {
  stage: string
  progress: number
  chunk?: number
  total_chunks?: number
  error?: string
  transcription_id?: string
}
