'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const WELCOME = `Bonjour ! Je suis l'assistant de pilotage du Wagon.

Tu peux me demander :
• "Comment je me situe par rapport à mon objectif ?"
• "Analyse mes ventes de la semaine"
• "Mon ROI estimé si je continue ?"
• "Quand est-ce que je rembourse mon emprunt ?"

Plus tu saisis tes données (caisse, factures, événements), plus mes analyses seront précises.`

const QUICK_QUESTIONS = [
  'Comment je me situe vs objectif ?',
  'Analyse mes ventes',
  'Mon ROI estimé ?',
  'Prévision semaine prochaine',
  'Je suis dans les clous pour le prêt ?',
]

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    const userMsg: Message = { role: 'user', content: msg }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.filter(m => m.content !== WELCOME) }),
      })
      const data = await res.json()
      if (data.content) {
        setMessages([...newMessages, { role: 'assistant', content: data.content }])
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.error || 'Désolé, je n\'ai pas pu répondre.' }])
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Erreur de connexion.' }])
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="playfair text-xl font-bold text-amber-400 mb-2">Assistant</h1>

      {/* Context indicator */}
      <div className="flex gap-3 text-xs text-stone-500 mb-3 flex-wrap">
        <span>📊 Ventes en DB</span>
        <span>📄 Factures en DB</span>
        <span>📅 Événements en DB</span>
        <span className="text-amber-600">← Plus tu saisis, plus j'analyse bien</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-sm mr-2 mt-1 shrink-0">
                🤖
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-amber-500/20 text-amber-100 border border-amber-500/20 rounded-tr-sm'
                  : 'bg-stone-800 text-stone-200 border border-stone-700/50 rounded-tl-sm'
              }`}
            >
              {msg.content.split('\n').map((line, j) => (
                <span key={j}>
                  {line}
                  {j < msg.content.split('\n').length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-sm shrink-0">
              🤖
            </div>
            <div className="bg-stone-800 border border-stone-700/50 rounded-2xl px-4 py-2.5 text-stone-400 text-sm">
              <span className="animate-pulse">Analyse en cours...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      <div className="flex gap-2 flex-wrap py-2 border-t border-stone-800">
        {QUICK_QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => send(q)}
            className="text-xs bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-full border border-stone-700 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Pose une question sur le bar..."
          className="input flex-1 !rounded-full !py-2.5"
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="btn-primary !rounded-full !px-5 !py-2.5"
        >
          →
        </button>
      </div>
    </div>
  )
}
