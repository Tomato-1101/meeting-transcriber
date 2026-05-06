import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { AIResult, ChatMessage, Transcription } from '../types'

interface HistoryContextValue {
  transcriptions: Transcription[]
  addTranscription: (t: Transcription) => void
  renameTranscription: (id: string, filename: string) => void
  deleteTranscription: (id: string) => void
  addAIResult: (transcriptionId: string, r: AIResult) => void
  deleteAIResult: (transcriptionId: string, aiResultId: string) => void
  addChatMessages: (
    transcriptionId: string,
    aiResultId: string,
    messages: ChatMessage[],
  ) => void
  replaceAll: (next: Transcription[]) => void
  clearAll: () => void
}

const HistoryContext = createContext<HistoryContextValue | null>(null)

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])

  const addTranscription = useCallback((t: Transcription) => {
    setTranscriptions((prev) => [t, ...prev])
  }, [])

  const renameTranscription = useCallback((id: string, filename: string) => {
    setTranscriptions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, filename } : t)),
    )
  }, [])

  const deleteTranscription = useCallback((id: string) => {
    setTranscriptions((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addAIResult = useCallback((transcriptionId: string, r: AIResult) => {
    setTranscriptions((prev) =>
      prev.map((t) =>
        t.id === transcriptionId ? { ...t, ai_results: [r, ...t.ai_results] } : t,
      ),
    )
  }, [])

  const deleteAIResult = useCallback((transcriptionId: string, aiResultId: string) => {
    setTranscriptions((prev) =>
      prev.map((t) =>
        t.id === transcriptionId
          ? { ...t, ai_results: t.ai_results.filter((r) => r.id !== aiResultId) }
          : t,
      ),
    )
  }, [])

  const addChatMessages = useCallback(
    (transcriptionId: string, aiResultId: string, messages: ChatMessage[]) => {
      setTranscriptions((prev) =>
        prev.map((t) =>
          t.id === transcriptionId
            ? {
                ...t,
                ai_results: t.ai_results.map((r) =>
                  r.id === aiResultId
                    ? { ...r, chat_messages: [...r.chat_messages, ...messages] }
                    : r,
                ),
              }
            : t,
        ),
      )
    },
    [],
  )

  const replaceAll = useCallback((next: Transcription[]) => {
    setTranscriptions(next)
  }, [])

  const clearAll = useCallback(() => {
    setTranscriptions([])
  }, [])

  return (
    <HistoryContext.Provider
      value={{
        transcriptions,
        addTranscription,
        renameTranscription,
        deleteTranscription,
        addAIResult,
        deleteAIResult,
        addChatMessages,
        replaceAll,
        clearAll,
      }}
    >
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext)
  if (!ctx) throw new Error('useHistory must be used inside HistoryProvider')
  return ctx
}
