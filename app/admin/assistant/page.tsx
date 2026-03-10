'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

function renderText(text: string): ReactNode[] {
  // Parse **bold** and render as <strong>
  return text.split('\n').map((line, i) => {
    const parts: ReactNode[] = []
    let remaining = line
    let key = 0
    while (remaining.length > 0) {
      const boldStart = remaining.indexOf('**')
      if (boldStart === -1) {
        parts.push(remaining)
        break
      }
      const boldEnd = remaining.indexOf('**', boldStart + 2)
      if (boldEnd === -1) {
        parts.push(remaining)
        break
      }
      if (boldStart > 0) parts.push(remaining.slice(0, boldStart))
      parts.push(
        <strong key={key++} style={{ color: 'var(--gold-light)' }}>
          {remaining.slice(boldStart + 2, boldEnd)}
        </strong>
      )
      remaining = remaining.slice(boldEnd + 2)
    }
    if (i < text.split('\n').length - 1) parts.push(<br key={`br${i}`} />)
    return <span key={i}>{parts}</span>
  })
}

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
      if (!res.ok) {
        let errMsg = `Erreur ${res.status}`
        try { const d = await res.json(); errMsg = d.error || errMsg } catch {}
        setMessages([...newMessages, { role: 'assistant', content: errMsg }])
      } else {
        const data = await res.json()
        setMessages([...newMessages, { role: 'assistant', content: data.content || data.error || 'Pas de réponse.' }])
      }
    } catch (err: any) {
      setMessages([...newMessages, { role: 'assistant', content: `Erreur réseau: ${err?.message || 'connexion impossible'}` }])
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="playfair text-lg font-bold mb-2" style={{ color: 'var(--gold)' }}>Assistant</h1>

      {/* Context indicator */}
      <div className="flex gap-3 text-xs mb-3 flex-wrap" style={{ color: 'var(--text-muted)' }}>
        <span>📊 Ventes</span>
        <span>📄 Factures</span>
        <span>📅 Événements</span>
        <span style={{ color: 'var(--gold)' }}>← Plus tu saisis, plus j'analyse bien</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm mr-2 mt-1 shrink-0"
                style={{ background: 'rgba(212,165,116,0.2)', border: '1px solid rgba(212,165,116,0.3)' }}>
                🤖
              </div>
            )}
            <div
              className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
              style={msg.role === 'user'
                ? { background: 'rgba(212,165,116,0.15)', color: 'var(--gold-light)', border: '1px solid rgba(212,165,116,0.2)', borderTopRightRadius: '4px' }
                : { background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid #333', borderTopLeftRadius: '4px' }
              }
            >
              {renderText(msg.content)}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
              style={{ background: 'rgba(212,165,116,0.2)', border: '1px solid rgba(212,165,116,0.3)' }}>
              🤖
            </div>
            <div className="rounded-2xl px-4 py-2.5 text-sm" style={{ background: 'var(--bg-card)', border: '1px solid #333', color: 'var(--text-muted)' }}>
              <span className="animate-pulse">Analyse en cours...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      <div className="flex gap-2 flex-wrap py-2" style={{ borderTop: '1px solid #333' }}>
        {QUICK_QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => send(q)}
            className="text-xs px-3 py-1.5 rounded-full transition-colors"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid #444' }}
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
