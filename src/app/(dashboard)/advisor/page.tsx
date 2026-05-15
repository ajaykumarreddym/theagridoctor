'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Plus, MessageSquare, Sprout, Loader2, ChevronLeft, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { VoiceInput } from '@/components/advisor/voice-input'
import type { ChatSession, ChatMessage } from '@/types/chat'
import { useChatStore } from '@/lib/store'

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
          <Sprout className="w-4 h-4 text-emerald-700" />
        </div>
      )}
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-emerald-600 text-white rounded-br-sm whitespace-pre-wrap'
            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
        }`}
      >
        {isUser ? msg.content : <Markdown content={msg.content} compact />}
      </div>
    </div>
  )
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start mb-4">
      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
        <Sprout className="w-4 h-4 text-emerald-700" />
      </div>
      <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed bg-white text-slate-800 border border-slate-200 shadow-sm">
        {content ? (
          <Markdown content={content} compact />
        ) : (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span className="text-xs">AgriDoctor is thinking…</span>
          </div>
        )}
        {content && (
          <span className="inline-block w-1.5 h-4 bg-emerald-500 ml-0.5 animate-pulse rounded-sm align-middle" />
        )}
      </div>
    </div>
  )
}

export default function AdvisorPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [voiceLang, setVoiceLang] = useState<'English' | 'Hindi' | 'Telugu'>(() => {
    if (typeof window === 'undefined') return 'English'
    const saved = window.localStorage.getItem('advisorVoiceLang')
    return saved === 'Hindi' || saved === 'Telugu' ? saved : 'English'
  })

  const { activeSessionId, setActiveSessionId, setIsStreaming } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Preserves typed text when mic starts so interim results append instead of overwriting
  const voiceBaseRef = useRef<string>('')

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load sessions on mount
  useEffect(() => {
    fetch('/api/chat/sessions')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSessions(data)
      })
  }, [])

  // Load messages when session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      return
    }
    fetch(`/api/chat/sessions/${activeSessionId}/messages`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data)
      })
  }, [activeSessionId])

  useEffect(scrollToBottom, [messages, streamingContent])

  const creatingSessionRef = useRef(false)
  const createNewSession = useCallback(async (): Promise<ChatSession | null> => {
    if (creatingSessionRef.current) return null
    creatingSessionRef.current = true
    try {
      const res = await fetch('/api/chat/sessions', { method: 'POST' })
      if (!res.ok) return null
      const session: ChatSession = await res.json()
      setSessions(prev => [session, ...prev])
      setActiveSessionId(session.id)
      setMessages([])
      setSidebarOpen(false)
      return session
    } finally {
      creatingSessionRef.current = false
    }
  }, [])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return
    
    // Ensure we have an active session
    let sessionId = activeSessionId
    if (!sessionId) {
      const newSession = await createNewSession()
      if (!newSession) return
      sessionId = newSession.id
    }

    const userMsg = input.trim()
    setInput('')
    setIsLoading(true)
    setIsStreaming(true)
    setStreamingContent('')

    // Optimistic UI
    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content: userMsg,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, sessionId }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to send')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      // Read the entire stream
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: false })
        accumulated += chunk
        setStreamingContent(accumulated)
      }

      // Ensure we got the complete response
      if (accumulated.trim()) {
        // Commit streamed message with full content
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          session_id: sessionId,
          role: 'assistant',
          content: accumulated,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, aiMsg])
      }
      setStreamingContent('')

      // Update session title in sidebar if it was "New Conversation"
      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId && s.title === 'New Conversation'
            ? { ...s, title: userMsg.length > 50 ? userMsg.slice(0, 50) + '…' : userMsg }
            : s
        )
      )
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        session_id: sessionId,
        role: 'assistant',
        content: '⚠️ Sorry, I encountered an error. Please try again.',
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errMsg])
      setStreamingContent('')
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      textareaRef.current?.focus()
    }
  }, [input, isLoading, activeSessionId, setIsStreaming, createNewSession])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Send button handler - just calls sendMessage which handles session creation
  const handleSend = async () => {
    sendMessage()
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-4 sm:-m-6 lg:-m-8 overflow-hidden">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sessions sidebar */}
      <aside
        className={`absolute md:relative inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Conversations</h2>
          <Button
            size="sm"
            onClick={createNewSession}
            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              No conversations yet. Start chatting!
            </div>
          ) : (
            sessions.map(session => (
              <button
                key={session.id}
                onClick={() => { setActiveSessionId(session.id); setSidebarOpen(false) }}
                className={`w-full text-left px-4 py-3 flex items-start hover:bg-slate-50 transition-colors group ${
                  activeSessionId === session.id ? 'bg-emerald-50 border-r-2 border-emerald-500' : ''
                }`}
              >
                <MessageSquare className={`w-4 h-4 mr-3 mt-0.5 flex-shrink-0 ${
                  activeSessionId === session.id ? 'text-emerald-600' : 'text-slate-400'
                }`} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    activeSessionId === session.id ? 'text-emerald-700' : 'text-slate-700'
                  }`}>
                    {session.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(session.created_at).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main chat panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="h-14 px-4 border-b border-slate-200 bg-white flex items-center gap-3 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </Button>
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <Sprout className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">AgriDoctor AI Advisor</p>
            <p className="text-xs text-emerald-600">Powered by LLaMA 3.3</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {!activeSessionId && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <Sprout className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Ask anything about your farm</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-sm">
                Your AI advisor knows your farms, crops, and recent diagnoses. Get personalized agricultural advice instantly.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {[
                  'How do I treat early blight on my tomatoes?',
                  'Best fertilizer schedule for wheat in November?',
                  'Is it time to harvest my cotton crop?',
                  'How much water does rice need at flowering stage?',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="text-left text-xs text-slate-600 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 px-3 py-2.5 rounded-lg transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              {streamingContent && <StreamingBubble content={streamingContent} />}
              {isLoading && !streamingContent && (
                <div className="flex justify-start mb-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-2">
                    <Sprout className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex space-x-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className={`w-2 h-2 rounded-full bg-slate-300 animate-bounce`} style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input bar */}
        <div className="px-4 py-3 border-t border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your crops, disease treatment, irrigation timing…"
                rows={1}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all max-h-32"
                style={{ minHeight: '48px' }}
                onInput={e => {
                  const el = e.target as HTMLTextAreaElement
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 128) + 'px'
                }}
              />
            </div>
            <VoiceInput
              disabled={isLoading}
              language={voiceLang}
              onStart={() => { 
                voiceBaseRef.current = input
                // Auto-focus input when mic is clicked
                textareaRef.current?.focus()
              }}
              onInterim={(text) => {
                const base = voiceBaseRef.current
                setInput(base + (base && text ? ' ' : '') + text)
              }}
              onTranscript={() => { /* interim already mirrors the full transcript */ }}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="h-12 w-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 flex-shrink-0"
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">Press Enter to send · Shift+Enter for new line · Tap the mic to speak</p>
          {/* Voice language picker */}
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Mic language:</span>
            {(['English', 'Hindi', 'Telugu'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  setVoiceLang(lang)
                  if (typeof window !== 'undefined') window.localStorage.setItem('advisorVoiceLang', lang)
                }}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  voiceLang === lang
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {lang === 'English' ? 'EN' : lang === 'Hindi' ? 'हिंदी' : 'తెలుగు'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
