'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      if (data.content) {
        setMessages([...newMessages, { role: 'assistant', content: data.content }])
      } else {
        setMessages([...newMessages, { role: 'assistant', content: 'Désolé, je n\'ai pas pu répondre.' }])
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Erreur de connexion.' }])
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="text-xl font-bold text-amber-400 mb-4">Assistant</h1>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="text-center text-stone-500 py-12 space-y-3">
            <div className="text-3xl">💬</div>
            <p className="text-sm">Pose une question sur ton bar</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                'Combien j\'ai fait ce mois ?',
                'Ma meilleure journée ?',
                'Je suis dans les clous pour le prêt ?',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-xs bg-stone-800 text-stone-400 px-3 py-1.5 rounded-lg border border-stone-700 hover:border-amber-500/50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-amber-500/20 text-amber-100 rounded-br-sm'
                  : 'bg-stone-800 text-stone-200 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-stone-800 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-stone-400">
              Réflexion...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-stone-800">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Pose ta question..."
          className="input flex-1 !rounded-full !py-2.5"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="btn-primary !rounded-full !px-5 !py-2.5"
        >
          →
        </button>
      </div>
    </div>
  )
}
