'use client'

import { useState, useEffect } from 'react'

const EVENT_TYPES: Record<string, string> = {
  meteo: '🌦️ Météo',
  ramadan: '🌙 Ramadan',
  travaux: '🚧 Travaux',
  evenement: '🎉 Événement',
  fermeture: '🔒 Fermeture',
  concurrence: '⚔️ Concurrence',
  autre: '📌 Autre',
}

const IMPACT_STYLE: Record<string, { color: string; label: string }> = {
  positif: { color: '#4ade80', label: '↑ Positif' },
  negatif: { color: '#c93545', label: '↓ Négatif' },
  neutre: { color: 'var(--text-muted)', label: '→ Neutre' },
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
  const [seeding, setSeeding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState('')
  const [type, setType] = useState('evenement')
  const [description, setDescription] = useState('')
  const [impact, setImpact] = useState('neutre')

  const loadEvents = () => {
    fetch('/api/events')
      .then(r => r.ok ? r.json() : { events: [] })
      .then(data => setEvents(data.events || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // Auto-seed on first load, then fetch
    fetch('/api/events/seed', { method: 'POST' })
      .then(() => loadEvents())
      .catch(() => loadEvents())
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
        setType('evenement')
        setDescription('')
        setImpact('neutre')
        setShowForm(false)
      }
    } catch { /* */ }
    setSaving(false)
  }

  // Group events by week
  const today = new Date().toISOString().slice(0, 10)
  const thisWeek = events.filter(e => {
    const d = new Date(e.date)
    const diff = (d.getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff < 7
  })
  const nextWeek = events.filter(e => {
    const d = new Date(e.date)
    const diff = (d.getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 7 && diff < 14
  })
  const past = events.filter(e => e.date < today)

  const renderEvent = (e: Event) => {
    const isToday = e.date === today
    const impactStyle = IMPACT_STYLE[e.impact] || IMPACT_STYLE.neutre
    const dateObj = new Date(e.date)
    const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' })
    const dayNum = dateObj.getDate()

    return (
      <div key={`${e.id}-${e.date}`} className="flex items-start gap-3 py-2" style={isToday ? { background: 'rgba(212,165,116,0.05)', margin: '0 -12px', padding: '8px 12px', borderRadius: '8px' } : {}}>
        <div className="text-center min-w-[36px]">
          <div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{dayName}</div>
          <div className="text-sm font-bold" style={{ color: isToday ? 'var(--gold)' : 'var(--text-secondary)' }}>{dayNum}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">{EVENT_TYPES[e.type]?.split(' ')[0] || '📌'}</span>
            <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{e.description}</span>
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{EVENT_TYPES[e.type] || e.type}</div>
        </div>
        <span className="text-xs font-bold shrink-0" style={{ color: impactStyle.color }}>
          {impactStyle.label.split(' ')[0]}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="playfair text-lg font-bold" style={{ color: 'var(--gold)' }}>Événements</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: showForm ? 'var(--red)' : 'var(--bg-card)', color: showForm ? 'white' : 'var(--gold)', border: '1px solid #444' }}
        >
          {showForm ? '✕ Annuler' : '+ Ajouter'}
        </button>
      </div>

      {/* Formulaire caché */}
      {showForm && (
        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input !py-2 !text-sm" />
            </div>
            <div>
              <label className="label">Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="select !py-2 !text-sm">
                {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input type="text" placeholder="Match, travaux, concert..." value={description}
              onChange={e => setDescription(e.target.value)} className="input !py-2 !text-sm" />
          </div>
          <div>
            <label className="label">Impact</label>
            <div className="flex gap-2">
              {(['positif', 'neutre', 'negatif'] as const).map(imp => (
                <button key={imp} onClick={() => setImpact(imp)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: impact === imp ? (imp === 'positif' ? '#4ade80' : imp === 'negatif' ? '#c93545' : 'var(--gold)') : 'var(--bg-card-alt)',
                    color: impact === imp ? 'var(--bg-dark)' : 'var(--text-muted)',
                    border: impact === imp ? 'none' : '1px solid #444',
                  }}
                >
                  {IMPACT_STYLE[imp].label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={addEvent} disabled={saving || !date || !description} className="btn-primary w-full !py-2 text-sm">
            {saving ? 'Enregistrement...' : 'Ajouter'}
          </button>
        </div>
      )}

      {/* Events lists */}
      {loading ? (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
      ) : (
        <>
          {/* Cette semaine */}
          {thisWeek.length > 0 && (
            <div className="card !p-3">
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--gold)' }}>Cette semaine</div>
              <div className="divide-y" style={{ borderColor: '#333' }}>
                {thisWeek.map(renderEvent)}
              </div>
            </div>
          )}

          {/* Semaine prochaine */}
          {nextWeek.length > 0 && (
            <div className="card !p-3">
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Semaine prochaine</div>
              <div className="divide-y" style={{ borderColor: '#333' }}>
                {nextWeek.map(renderEvent)}
              </div>
            </div>
          )}

          {/* Passés (collapsed) */}
          {past.length > 0 && (
            <div className="card !p-3">
              <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Passés ({past.length})</div>
              <div className="divide-y" style={{ borderColor: '#333' }}>
                {past.slice(0, 5).map(renderEvent)}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              Aucun événement — clique + Ajouter
            </div>
          )}
        </>
      )}
    </div>
  )
}
