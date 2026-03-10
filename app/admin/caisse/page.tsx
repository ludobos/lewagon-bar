'use client'

import { useState, useEffect } from 'react'

type DayData = { date: string; ca: number; nb: number }

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const BAR_COLORS = ['#a0a0a0', '#6ba3d6', '#22d3ee', '#fb923c', '#4ade80']
const JOURS_BAR = [2, 3, 4, 5, 6]

function fmt(n: number) { return Math.round(n).toLocaleString('fr-FR') }

export default function CaissePage() {
  const [days, setDays] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/transactions?days=30')
      .then(r => r.json())
      .then(data => setDays(data.days || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement...</div>

  const total = days.reduce((s, d) => s + d.ca, 0)
  const avg = days.length > 0 ? total / days.length : 0
  const best = days.length > 0 ? Math.max(...days.map(d => d.ca)) : 0
  const worst = days.length > 0 ? Math.min(...days.map(d => d.ca)) : 0
  const nbTx = days.reduce((s, d) => s + d.nb, 0)
  const ticketMoyen = nbTx > 0 ? total / nbTx : 0

  // CA par jour de la semaine
  const byWeekday: Record<number, { total: number; count: number }> = {}
  days.forEach(d => {
    const dow = new Date(d.date).getDay()
    if (!byWeekday[dow]) byWeekday[dow] = { total: 0, count: 0 }
    byWeekday[dow].total += d.ca
    byWeekday[dow].count++
  })

  const maxWeekdayAvg = Math.max(...JOURS_BAR.map(dow => byWeekday[dow] ? byWeekday[dow].total / byWeekday[dow].count : 0))
  const bestDow = JOURS_BAR.reduce((best, dow) => {
    const avg = byWeekday[dow] ? byWeekday[dow].total / byWeekday[dow].count : 0
    const bestAvg = byWeekday[best] ? byWeekday[best].total / byWeekday[best].count : 0
    return avg > bestAvg ? dow : best
  }, JOURS_BAR[0])

  // Périodes (basé sur timestamps des transactions - approximation)
  const maxCa = days.length > 0 ? Math.max(...days.map(d => d.ca)) : 1

  return (
    <div className="space-y-4">
      <h1 className="playfair text-lg font-bold" style={{ color: 'var(--gold)' }}>30 derniers jours</h1>

      {/* Résumé chiffré */}
      <div className="grid grid-cols-2 gap-2">
        <div className="card !p-3 text-center">
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>CA total</div>
          <div className="text-lg font-bold" style={{ color: 'var(--gold)' }}>{fmt(total)}€</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{days.length} jours · {fmt(nbTx)} ventes</div>
        </div>
        <div className="card !p-3 text-center">
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Ticket moyen</div>
          <div className="text-lg font-bold" style={{ color: ticketMoyen >= 10 ? '#4ade80' : 'var(--gold)' }}>{ticketMoyen.toFixed(2)}€</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>objectif 10€</div>
        </div>
        <div className="card !p-3 text-center">
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Meilleur jour</div>
          <div className="text-lg font-bold" style={{ color: '#4ade80' }}>{fmt(best)}€</div>
        </div>
        <div className="card !p-3 text-center">
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Jour le plus calme</div>
          <div className="text-lg font-bold" style={{ color: 'var(--text-secondary)' }}>{fmt(worst)}€</div>
        </div>
      </div>

      {/* Rythme du bar */}
      <div className="card !p-3">
        <div className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>CA moyen par jour</div>
        <div className="flex items-end gap-2 h-28">
          {JOURS_BAR.map((dow, i) => {
            const data = byWeekday[dow]
            const avg = data ? data.total / data.count : 0
            const pct = maxWeekdayAvg > 0 ? (avg / maxWeekdayAvg) * 100 : 0
            const isBest = dow === bestDow
            return (
              <div key={dow} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold" style={{ color: isBest ? '#4ade80' : 'var(--text-secondary)' }}>
                  {avg > 0 ? `${fmt(avg)}€` : '--'}
                </span>
                <div className="w-full rounded-t transition-all" style={{
                  height: `${Math.max(8, pct)}%`,
                  background: BAR_COLORS[i],
                  opacity: 0.8,
                }} />
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{JOURS[dow]}</span>
              </div>
            )
          })}
        </div>
        {byWeekday[bestDow] && (
          <div className="text-[10px] mt-2 text-center" style={{ color: '#4ade80' }}>
            {JOURS[bestDow]} = meilleur jour
            {byWeekday[2] && byWeekday[bestDow] ? ` (${(byWeekday[bestDow].total / byWeekday[bestDow].count / (byWeekday[2].total / byWeekday[2].count)).toFixed(1)}x le Mardi)` : ''}
          </div>
        )}
      </div>

      {/* CA journalier 30 jours */}
      <div className="card !p-3">
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>CA journalier</div>
        <div className="space-y-0.5">
          {days.map(d => {
            const pct = Math.max(3, (d.ca / maxCa) * 100)
            const dateStr = new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
            const above = d.ca >= avg
            return (
              <div key={d.date} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>{dateStr}</span>
                <div className="flex-1 h-4 rounded overflow-hidden relative" style={{ background: 'var(--bg-card-alt)' }}>
                  <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: above ? '#4ade80' : 'var(--gold)', opacity: 0.7 }} />
                </div>
                <span className="w-12 text-right text-[10px] font-medium" style={{ color: above ? '#4ade80' : 'var(--text-secondary)' }}>
                  {fmt(d.ca)}€
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
