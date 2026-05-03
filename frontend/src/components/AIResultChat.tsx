import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, User, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { listChatMessages, sendChatMessage } from '../api/client'
import type { ChatMessage } from '../types'

interface Props {
  aiResultId: string
}

const MODEL_STORAGE_KEY = 'ai_chat_model'

export function AIResultChat({ aiResultId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [model, setModel] = useState(() => {
    if (typeof window === 'undefined') return 'gemini-2.5-flash'
    return localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-2.5-flash'
  })
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    listChatMessages(aiResultId)
      .then((m) => {
        if (!cancelled) setMessages(m)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [aiResultId])

  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE_KEY, model)
  }, [model])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)

    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      ai_result_id: aiResultId,
      role: 'user',
      content,
      model_used: null,
      created_at: new Date().toISOString(),
      sequence_order: messages.length,
    }
    setMessages((prev) => [...prev, optimistic])
    setInput('')

    try {
      const { user, assistant } = await sendChatMessage(aiResultId, content, model)
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), user, assistant])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '送信に失敗しました')
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">この内容について質問</h4>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="text-xs border border-gray-300 rounded px-2 py-1"
        >
          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
          <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
          <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
          <option value="gpt-4.1-nano">GPT-4.1 Nano</option>
        </select>
      </div>

      <div
        ref={scrollRef}
        className="border border-gray-200 rounded-lg bg-gray-50 max-h-96 overflow-y-auto p-3 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-4">
            質問を入力すると、この AI 結果と元の文字起こしを参照して回答します
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                  m.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-pre:my-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex gap-2">
            <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-gray-200 text-gray-700">
              <Bot size={14} />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin inline mr-2" />
              考え中...
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="質問を入力 (Enterで送信、Shift+Enterで改行)"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none h-12 min-h-[3rem]"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  )
}
