'use client'

import { useState, useEffect } from 'react'

type DayData = { date: string; ca: number }
type EventData = { date: string; type: string; description: string; impact: string }
type WeatherDay = { date: string; day: string; icon: string; label: string; max: number; min: number }
type WeekdayData = { dow: number; ca_moyen: number; nb_jours: number }

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const JOURS_BAR = [2, 3, 4, 5, 6] // Mardi-Samedi

function fmt(n: number) { return Math.round(n).toLocaleString('fr-FR') }

function getWeatherTip(weather: WeatherDay[]): { text: string; detail: string; type: string } | null {
  if (!weather.length) return null
  const today = weather[0]
  const weekend = weather.filter(w => {
    const d = new Date(w.date).getDay()
    return d === 5 || d === 6 // Vendredi + Samedi
  })

  const isSunny = today.max >= 15 && !today.label.includes('Pluie') && !today.label.includes('Orage')
  const isRainy = today.label.includes('Pluie') || today.label.includes('Averse') || today.label.includes('Orage')

  if (isSunny) {
    return {
      text: `${today.icon} ${today.max}° aujourd'hui — terrasse ouverte`,
      detail: 'Stock bières, sodas, rosé, cocktails. Les gens restent plus longtemps dehors.',
      type: 'green',
    }
  }
  if (isRainy) {
    return {
      text: `${today.icon} Pluie aujourd'hui — mode cosy`,
      detail: 'Stock café, chocolat, thé, planches. Les habitués viennent quand même.',
      type: 'orange',
    }
  }
  // Check weekend
  const sunnyWeekend = weekend.filter(w => w.max >= 15 && !w.label.includes('Pluie'))
  if (sunnyWeekend.length > 0) {
    return {
      text: `☀️ Beau week-end annoncé`,
      detail: '+50% stock bière + sodas, prépare les cocktails, rosé en pichet.',
      type: 'green',
    }
  }
  return {
    text: `${today.icon} ${today.max}° — ${today.label}`,
    detail: 'Journée standard. Les habitués font le boulot.',
    type: 'gold',
  }
}

export default function DashboardTab() {
  const [stats, setStats] = useState<any>(null)
  const [yesterday, setYesterday] = useState(0)
  const [days, setDays] = useState<DayData[]>([])
  const [weekdays, setWeekdays] = useState<WeekdayData[]>([])
  const [events, setEvents] = useState<EventData[]>([])
  const [target, setTarget] = useState(500)
  const [weather, setWeather] = useState<{ this_week: WeatherDay[]; next_week: WeatherDay[] }>({ this_week: [], next_week: [] })
  const [loading, setLoading] = useState(true)
  const [editingTarget, setEditingTarget] = useState(false)
  const [newTarget, setNewTarget] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/weather').then(r => r.json()).catch(() => ({ this_week: [], next_week: [] })),
    ]).then(([dash, meteo]) => {
      setStats(dash.stats)
      setYesterday(dash.yesterday || 0)
      setDays(dash.days || [])
      setWeekdays(dash.weekday_pattern || [])
      setEvents(dash.events || [])
      setTarget(dash.target || 500)
      setNewTarget(String(dash.target || 500))
      setWeather(meteo)
      setLoading(false)
    })
  }, [])

  const saveTarget = async () => {
    const val = parseInt(newTarget)
    if (!val || val <= 0) return
    setTarget(val)
    setEditingTarget(false)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daily_target: val }),
    })
    const dash = await fetch('/api/dashboard').then(r => r.json())
    setStats(dash.stats)
  }

  if (loading) return <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement...</div>

  const avg = stats?.ca_moyen || 0
  const record = stats?.ca_max || 0
  const nbJours = parseInt(stats?.nb_jours || '0')
  const joursObj = parseInt(stats?.jours_objectif || '0')
  const maxCa = Math.max(...days.map(d => d.ca), target)
  const weatherTip = getWeatherTip(weather.this_week)

  // Best day of the week
  const bestWeekday = weekdays.reduce((best, w) =>
    JOURS_BAR.includes(w.dow) && w.ca_moyen > (best?.ca_moyen || 0) ? w : best, weekdays[0])

  return (
    <div className="space-y-4">
      {/* Objectif editable */}
      <div className="flex items-center justify-end">
        {editingTarget ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={newTarget}
              onChange={e => setNewTarget(e.target.value)}
              className="w-20 rounded-lg px-2 py-1 text-sm text-center"
              style={{ background: 'var(--bg-card-alt)', border: '1px solid #444', color: 'var(--text-primary)' }}
              autoFocus
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>€/j</span>
            <button onClick={saveTarget} className="text-xs font-medium" style={{ color: 'var(--gold)' }}>OK</button>
            <button onClick={() => setEditingTarget(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setEditingTarget(true)} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>
            Obj. {target}€/j ✏️
          </button>
        )}
      </div>

      {/* LA BONNE NOUVELLE — positive stat */}
      {avg > 0 && (
        <div className="tip-card tip-green">
          <div className="text-xs font-bold mb-1" style={{ color: '#4ade80' }}>LA BONNE NOUVELLE</div>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {avg >= target
              ? `Tu fais ${fmt(avg)}€/jour en moyenne — au-dessus de ton objectif de ${target}€ !`
              : `Tu fais déjà ${fmt(avg)}€/jour en moyenne sur ${nbJours} jours. C'est ${Math.round((avg / target) * 100)}% de ton objectif.`
            }
          </div>
          {record > 0 && (
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Record : {fmt(record)}€ — tu sais que c'est possible
            </div>
          )}
        </div>
      )}

      {/* 3 chiffres clés */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card !p-3 text-center">
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Moyenne/jour</div>
          <div className="text-lg font-bold" style={{ color: avg >= target ? '#4ade80' : 'var(--gold)' }}>
            {avg > 0 ? `${fmt(avg)}€` : '--'}
          </div>
        </div>
        <div className="card !p-3 text-center">
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Record</div>
          <div className="text-lg font-bold" style={{ color: '#4ade80' }}>
            {record > 0 ? `${fmt(record)}€` : '--'}
          </div>
        </div>
        <div className="card !p-3 text-center">
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Projeté/mois</div>
          <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {avg > 0 ? `${fmt(avg * 20)}€` : '--'}
          </div>
        </div>
      </div>

      {/* Progression bar */}
      {nbJours > 0 && (
        <div className="card !p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {joursObj > 0 ? `${joursObj} jour${joursObj > 1 ? 's' : ''} au-dessus de ${target}€` : `En route vers ${target}€/jour`}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{nbJours}j</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-card-alt)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (avg / target) * 100)}%`, background: avg >= target ? '#4ade80' : 'var(--gold)' }}
            />
          </div>
        </div>
      )}

      {/* MÉTÉO — conseil stock */}
      {weatherTip && (
        <div className={`tip-card tip-${weatherTip.type}`}>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{weatherTip.text}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{weatherTip.detail}</div>
        </div>
      )}

      {/* Météo semaine */}
      {weather.this_week.length > 0 && (
        <div className="card !p-3">
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Météo Nantes</div>
          <div className="flex gap-0.5 overflow-x-auto pb-1">
            {weather.this_week.map((w, i) => (
              <div key={w.date} className="flex flex-col items-center min-w-[38px] px-0.5 py-1 rounded-lg text-center"
                style={i === 0 ? { background: 'rgba(212,165,116,0.1)', border: '1px solid rgba(212,165,116,0.2)' } : {}}>
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{i === 0 ? 'Auj' : w.day}</span>
                <span className="text-sm my-0.5">{w.icon}</span>
                <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>{w.max}°</span>
              </div>
            ))}
          </div>
          {weather.next_week.length > 0 && (
            <>
              <div className="text-[9px] mt-2 mb-1" style={{ color: 'var(--text-muted)' }}>Semaine pro</div>
              <div className="flex gap-0.5 overflow-x-auto pb-1">
                {weather.next_week.map(w => (
                  <div key={w.date} className="flex flex-col items-center min-w-[38px] px-0.5 py-1 text-center">
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{w.day}</span>
                    <span className="text-sm my-0.5">{w.icon}</span>
                    <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>{w.max}°</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* RYTHME DU BAR */}
      {weekdays.length > 0 && (
        <div className="card !p-3">
          <div className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Rythme du bar</div>
          <div className="flex items-end gap-1.5 h-24">
            {JOURS_BAR.map(dow => {
              const wd = weekdays.find(w => w.dow === dow)
              const ca = wd?.ca_moyen || 0
              const maxWd = Math.max(...weekdays.filter(w => JOURS_BAR.includes(w.dow)).map(w => w.ca_moyen))
              const pct = maxWd > 0 ? (ca / maxWd) * 100 : 0
              const isBest = wd === bestWeekday
              const barColors = ['#a0a0a0', '#6ba3d6', '#22d3ee', '#fb923c', '#4ade80']
              const colorIdx = JOURS_BAR.indexOf(dow)
              return (
                <div key={dow} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold" style={{ color: isBest ? '#4ade80' : 'var(--text-secondary)' }}>
                    {ca > 0 ? `${fmt(ca)}€` : '--'}
                  </span>
                  <div className="w-full rounded-t" style={{
                    height: `${Math.max(8, pct)}%`,
                    background: barColors[colorIdx],
                    opacity: 0.8,
                  }} />
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{JOURS[dow]}</span>
                </div>
              )
            })}
          </div>
          {bestWeekday && bestWeekday.ca_moyen > 0 && (
            <div className="text-[10px] mt-2 text-center" style={{ color: '#4ade80' }}>
              {JOURS[bestWeekday.dow]} = meilleur jour ({fmt(bestWeekday.ca_moyen)}€ moy.)
            </div>
          )}
        </div>
      )}

      {/* 21 derniers jours */}
      {days.length > 0 && (
        <div className="card !p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>21 derniers jours</span>
            <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded inline-block" style={{ background: 'var(--gold)' }}></span>CA</span>
              <span className="flex items-center gap-1"><span className="w-2 h-px inline-block" style={{ background: '#555' }}></span>{target}€</span>
            </div>
          </div>
          <div className="space-y-0.5">
            {[...days].reverse().map((d: any) => {
              const pct = Math.max(5, (d.ca / maxCa) * 100)
              const above = d.ca >= target
              const dateStr = new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
              return (
                <div key={d.date} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>{dateStr}</span>
                  <div className="flex-1 h-4 rounded overflow-hidden relative" style={{ background: 'var(--bg-card-alt)' }}>
                    <div
                      className="h-full rounded transition-all"
                      style={{ width: `${pct}%`, background: above ? '#4ade80' : 'var(--gold)', opacity: 0.7 }}
                    />
                    <div className="absolute top-0 bottom-0 w-px" style={{ left: `${(target / maxCa) * 100}%`, background: '#555' }} />
                  </div>
                  <span className="w-10 text-right text-[10px] font-medium" style={{ color: above ? '#4ade80' : 'var(--text-secondary)' }}>
                    {fmt(d.ca)}€
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Événements */}
      {events.length > 0 && (
        <div className="card !p-3">
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>À venir</div>
          <div className="space-y-1.5">
            {events.map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-10 shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>{e.date.slice(5).replace('-', '/')}</span>
                <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{e.description}</span>
                <span className="font-bold" style={{
                  color: e.impact === 'positif' ? '#4ade80' : e.impact === 'negatif' ? 'var(--red)' : 'var(--text-muted)'
                }}>
                  {e.impact === 'positif' ? '↑' : e.impact === 'negatif' ? '↓' : '→'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emprunt */}
      <div className="card !p-3">
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Emprunt BNP · 51 000€</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Mensualité</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>730€/mois</span>
          </div>
          {avg > 0 && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>% du CA projeté</span>
              <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {((730 / (avg * 20)) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
