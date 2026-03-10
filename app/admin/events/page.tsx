'use client'

import { useState, useEffect } from 'react'

const EVENT_TYPES: Record<string, string> = {
  meteo: '🌦️ Météo',
  ramadan: '🌙 Ramadan',
  travaux: '🚧 Travaux',
  evenement: '🎉 Événement local',
  fermeture: '🔒 Fermeture',
  concurrence: '⚔️ Concurrence',
  autre: '📌 Autre',
}

const IMPACT_STYLE: Record<string, { text: string; label: string }> = {
  positif: { text: 'text-emerald-400', label: '↑ Positif' },
  negatif: { text: 'text-red-400', label: '↓ Négatif' },
  neutre: { text: 'text-stone-400', label: '→ Neutre' },
}

type Event = {
  id: number
  date: string
  type: string
  description: string
  impact: string
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState('')
  const [type, setType] = useState('meteo')
  const [description, setDescription] = useState('')
  const [impact, setImpact] = useState('neutre')

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.ok ? r.json() : { events: [] })
      .then(data => setEvents(data.events || []))
      .finally(() => setLoading(false))
  }, [])

  const addEvent = async () => {
    if (!date || !description) return
    setSaving(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type, description, impact }),
      })
      const data = await res.json()
      if (data.event) {
        setEvents(prev => [data.event, ...prev])
        setDate('')
        setType('meteo')
        setDescription('')
        setImpact('neutre')
      }
    } catch { /* */ }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <h1 className="playfair text-lg font-bold" style={{ color: 'var(--gold)' }}>Événements</h1>

      {/* Form */}
      <div className="card space-y-4">
        <div>
          <p className="text-stone-500 text-sm mb-4">
            Météo, Ramadan, travaux, fête locale... L'assistant les prend en compte dans ses analyses.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select value={type} onChange={e => setType(e.target.value)} className="select">
              {Object.entries(EVENT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <input
            type="text"
            placeholder="ex: Début Ramadan, Match France-Espagne, Travaux quai..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Impact attendu sur les ventes</label>
          <div className="flex gap-2">
            {(['positif', 'neutre', 'negatif'] as const).map(imp => (
              <button
                key={imp}
                onClick={() => setImpact(imp)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  impact === imp
                    ? imp === 'positif' ? 'bg-emerald-500 text-stone-950'
                    : imp === 'negatif' ? 'bg-red-500 text-stone-950'
                    : 'bg-amber-500 text-stone-950'
                    : 'bg-stone-800 text-stone-400 border border-stone-700'
                }`}
              >
                {IMPACT_STYLE[imp].label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={addEvent}
          disabled={saving || !date || !description}
          className="btn-primary w-full"
        >
          {saving ? 'Enregistrement...' : 'Ajouter l\'événement'}
        </button>
      </div>

      {/* Event list */}
      {loading ? (
        <div className="text-center text-stone-500 py-8">Chargement...</div>
      ) : events.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-800">
            <h3 className="text-stone-200 font-semibold">{events.length} événement{events.length > 1 ? 's' : ''}</h3>
          </div>
          <div className="divide-y divide-stone-800/60">
            {events.map(e => (
              <div key={e.id} className="px-5 py-4 flex items-center gap-3 hover:bg-stone-800/20 transition-colors">
                <span className="text-stone-400 text-sm w-16 shrink-0">
                  {e.date.slice(5).replace('-', '/')}
                </span>
                <span className="text-xl">{EVENT_TYPES[e.type]?.split(' ')[0] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-stone-200 text-sm truncate">{e.description}</div>
                  <div className="text-stone-500 text-xs">{EVENT_TYPES[e.type] || e.type}</div>
                </div>
                <span className={`font-bold text-sm shrink-0 ${IMPACT_STYLE[e.impact]?.text || 'text-stone-400'}`}>
                  {IMPACT_STYLE[e.impact]?.label || e.impact}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
