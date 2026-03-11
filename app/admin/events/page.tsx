'use client'

import { useState, useEffect } from 'react'

const EVENT_TYPES: Record<string, string> = {
  meteo: '🌦️ Météo',
  ramadan: '🌙 Ramadan',
  travaux: '🚧 Travaux',
  'travaux-voirie': '🚧 Travaux voirie',
  evenement: '🎉 Événement',
  fermeture: '🔒 Fermeture',
  concurrence: '⚔️ Concurrence',
  'jour-ferie': '🎌 Jour férié',
  'vacances-scolaires': '🏖️ Vacances',
  'match-foot': '⚽ Match',
  autre: '📌 Autre',
}

const IMPACT_STYLE: Record<string, { color: string; label: string }> = {
  positif: { color: '#4ade80', label: '↑ Positif' },
  negatif: { color: '#c93545', label: '↓ Négatif' },
  neutre: { color: 'var(--text-muted)', label: '→ Neutre' },
}

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  'gouv.fr': { label: 'gouv.fr', color: '#6366f1' },
  'education.gouv.fr': { label: 'éducation', color: '#8b5cf6' },
  'nantes-metropole': { label: 'Nantes Métro', color: '#06b6d4' },
  manual: { label: '', color: '' },
  auto: { label: 'auto', color: '#78716c' },
}

type Event = {
  id: string
  date: string
  type: string
  description: string
  impact: string
  source?: string
  external_id?: string
  date_fin?: string
}

type WeatherDay = {
  date: string
  icon: string
  label: string
  max: number
  min: number
  terrasse_score?: number
  tip?: string
  precipitation_probability?: number
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState('')
  const [type, setType] = useState('evenement')
  const [description, setDescription] = useState('')
  const [impact, setImpact] = useState('neutre')
  const [weather, setWeather] = useState<WeatherDay | null>(null)

  const loadEvents = () => {
    fetch('/api/events')
      .then(r => r.ok ? r.json() : { events: [] })
      .then(data => setEvents(data.events || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadEvents()
    // Fetch météo du jour
    fetch('/api/weather')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.this_week?.[0]) setWeather(data.this_week[0])
      })
      .catch(() => {})
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
        loadEvents()
        setDate('')
        setType('evenement')
        setDescription('')
        setImpact('neutre')
        setShowForm(false)
      }
    } catch { /* */ }
    setSaving(false)
  }

  // Trouver prochain férié et vacances en cours
  const today = new Date().toISOString().slice(0, 10)
  const prochainFerie = events.find(e => e.type === 'jour-ferie' && e.date >= today)
  const vacancesEnCours = events.find(e =>
    e.type === 'vacances-scolaires' && e.date <= today && (e.date_fin || e.date) >= today
  )

  // Group events
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
    const isAuto = e.source && e.source !== 'manual'
    const badge = e.source ? SOURCE_BADGES[e.source] : null

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
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{EVENT_TYPES[e.type] || e.type}</span>
            {badge && badge.label && (
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: badge.color + '22', color: badge.color }}>
                {badge.label}
              </span>
            )}
            {e.date_fin && e.date_fin !== e.date && (
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>→ {new Date(e.date_fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
            )}
          </div>
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

      {/* Carte Contexte du jour */}
      {(weather || prochainFerie || vacancesEnCours) && (
        <div className="card !p-3 space-y-2">
          <div className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>Contexte du jour</div>
          <div className="grid grid-cols-2 gap-2">
            {weather && (
              <div className="rounded-lg p-2" style={{ background: 'var(--bg-card-alt)' }}>
                <div className="flex items-center gap-1">
                  <span className="text-lg">{weather.icon}</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{weather.max}°</span>
                </div>
                {weather.terrasse_score !== undefined && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: '#333' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${weather.terrasse_score * 10}%`,
                          background: weather.terrasse_score >= 7 ? '#4ade80' : weather.terrasse_score >= 4 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Terrasse {weather.terrasse_score}/10</span>
                  </div>
                )}
                {weather.tip && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{weather.tip}</div>}
              </div>
            )}
            <div className="space-y-1.5">
              {prochainFerie && (
                <div className="rounded-lg p-2" style={{ background: 'var(--bg-card-alt)' }}>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Prochain férié</div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    🎌 {prochainFerie.description}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {new Date(prochainFerie.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  </div>
                </div>
              )}
              {vacancesEnCours && (
                <div className="rounded-lg p-2" style={{ background: '#8b5cf622' }}>
                  <div className="text-[10px]" style={{ color: '#8b5cf6' }}>Vacances en cours</div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{vacancesEnCours.description}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Formulaire */}
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
                {Object.entries(EVENT_TYPES).filter(([k]) => !['jour-ferie', 'vacances-scolaires', 'travaux-voirie'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
          {thisWeek.length > 0 && (
            <div className="card !p-3">
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--gold)' }}>Cette semaine</div>
              <div className="divide-y" style={{ borderColor: '#333' }}>
                {thisWeek.map(renderEvent)}
              </div>
            </div>
          )}

          {nextWeek.length > 0 && (
            <div className="card !p-3">
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Semaine prochaine</div>
              <div className="divide-y" style={{ borderColor: '#333' }}>
                {nextWeek.map(renderEvent)}
              </div>
            </div>
          )}

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
