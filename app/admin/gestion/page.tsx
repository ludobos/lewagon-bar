'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// ─── Types ───
type DayData = { date: string; ca: number; nb: number }
type Invoice = { id: number; fournisseur: string; date: string; montant_ht: number; montant_ttc: number; categorie: string; description: string; filename: string }

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const BAR_COLORS = ['#a0a0a0', '#6ba3d6', '#22d3ee', '#fb923c', '#4ade80']
const JOURS_BAR = [2, 3, 4, 5, 6]
const CATEGORIES_COLORS: Record<string, string> = {
  boissons: 'bg-amber-500/20 text-amber-300',
  food: 'bg-emerald-500/20 text-emerald-300',
  charges: 'bg-red-500/20 text-red-300',
  materiel: 'bg-blue-500/20 text-blue-300',
  autres: 'bg-stone-600/40 text-stone-300',
}

function fmt(n: number) { return Math.round(n).toLocaleString('fr-FR') }

export default function GestionPage() {
  // Section navigation
  const [section, setSection] = useState<'ca' | 'factures'>('ca')
  const caRef = useRef<HTMLDivElement>(null)
  const facturesRef = useRef<HTMLDivElement>(null)

  // ─── CA State ───
  const [days, setDays] = useState<DayData[]>([])
  const [loadingCA, setLoadingCA] = useState(true)

  // ─── Factures State ───
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loadingInv, setLoadingInv] = useState(true)
  const [uploading, setUploading] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'dup' | 'err'; text: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/transactions?days=30')
      .then(r => r.json())
      .then(data => setDays(data.days || []))
      .finally(() => setLoadingCA(false))

    fetch('/api/invoices')
      .then(r => r.ok ? r.json() : { invoices: [] })
      .then(data => setInvoices(data.invoices || []))
      .finally(() => setLoadingInv(false))
  }, [])

  // ─── CA Calculations ───
  const total = days.reduce((s, d) => s + d.ca, 0)
  const avg = days.length > 0 ? total / days.length : 0
  const best = days.length > 0 ? Math.max(...days.map(d => d.ca)) : 0
  const worst = days.length > 0 ? Math.min(...days.map(d => d.ca)) : 0
  const nbTx = days.reduce((s, d) => s + d.nb, 0)
  const ticketMoyen = nbTx > 0 ? total / nbTx : 0
  const maxCa = days.length > 0 ? Math.max(...days.map(d => d.ca)) : 1

  const byWeekday: Record<number, { total: number; count: number }> = {}
  days.forEach(d => {
    const dow = new Date(d.date).getDay()
    if (!byWeekday[dow]) byWeekday[dow] = { total: 0, count: 0 }
    byWeekday[dow].total += d.ca
    byWeekday[dow].count++
  })
  const maxWeekdayAvg = Math.max(...JOURS_BAR.map(dow => byWeekday[dow] ? byWeekday[dow].total / byWeekday[dow].count : 0), 1)
  const bestDow = JOURS_BAR.reduce((b, dow) => {
    const a = byWeekday[dow] ? byWeekday[dow].total / byWeekday[dow].count : 0
    const ba = byWeekday[b] ? byWeekday[b].total / byWeekday[b].count : 0
    return a > ba ? dow : b
  }, JOURS_BAR[0])

  // ─── Factures Upload ───
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return
    setUploading(fileArray.length)
    setFeedback([])
    const newFeedback: typeof feedback = []
    for (const file of fileArray) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        const res = await fetch('/api/invoices/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.duplicate) {
          newFeedback.push({ type: 'dup', text: `${file.name} — déjà importée` })
        } else if (data.invoice) {
          setInvoices(prev => [data.invoice, ...prev])
          newFeedback.push({ type: 'ok', text: `${file.name} — ${data.invoice.fournisseur} ${data.invoice.montant_ttc?.toFixed(0)}€` })
        } else if (data.error) {
          newFeedback.push({ type: 'err', text: `${file.name} — ${data.error}` })
        }
      } catch {
        newFeedback.push({ type: 'err', text: `${file.name} — erreur réseau` })
      }
      setUploading(prev => prev - 1)
      setFeedback([...newFeedback])
    }
    setUploading(0)
    setTimeout(() => setFeedback([]), 8000)
  }, [])

  const totalExpenses = invoices.reduce((s, i) => s + (i.montant_ttc || 0), 0)

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>, sec: 'ca' | 'factures') => {
    setSection(sec)
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-4">
      {/* Section chips */}
      <div className="flex gap-2 sticky top-[52px] z-[5] pt-2 pb-3 -mx-4 px-4" style={{ background: 'var(--bg-dark)' }}>
        <button
          onClick={() => scrollTo(caRef, 'ca')}
          className="text-xs px-4 py-2 rounded-full font-medium transition-colors"
          style={section === 'ca'
            ? { background: 'var(--gold)', color: 'var(--bg-dark)' }
            : { background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid #444' }
          }
        >
          📈 CA 30 jours
        </button>
        <button
          onClick={() => scrollTo(facturesRef, 'factures')}
          className="text-xs px-4 py-2 rounded-full font-medium transition-colors"
          style={section === 'factures'
            ? { background: 'var(--gold)', color: 'var(--bg-dark)' }
            : { background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid #444' }
          }
        >
          📄 Factures {invoices.length > 0 ? `(${invoices.length})` : ''}
        </button>
        <a
          href="/admin/articles"
          className="text-xs px-4 py-2 rounded-full font-medium transition-colors"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid #444' }}
        >
          📊 Articles
        </a>
        <a
          href="/admin/events"
          className="text-xs px-4 py-2 rounded-full font-medium transition-colors"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid #444' }}
        >
          📅 Events
        </a>
      </div>

      {/* ═══════════ CA 30 JOURS ═══════════ */}
      <div ref={caRef}>
        {loadingCA ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
        ) : (
          <div className="space-y-4">
            {/* KPIs */}
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
                  const a = data ? data.total / data.count : 0
                  const pct = maxWeekdayAvg > 0 ? (a / maxWeekdayAvg) * 100 : 0
                  const isBest = dow === bestDow
                  return (
                    <div key={dow} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold" style={{ color: isBest ? '#4ade80' : 'var(--text-secondary)' }}>
                        {a > 0 ? `${fmt(a)}€` : '--'}
                      </span>
                      <div className="w-full rounded-t transition-all" style={{ height: `${Math.max(8, pct)}%`, background: BAR_COLORS[i], opacity: 0.8 }} />
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

            {/* CA journalier */}
            <div className="card !p-3">
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>CA journalier</div>
              <div className="space-y-0.5">
                {[...days].reverse().map(d => {
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
        )}
      </div>

      {/* ═══════════ FACTURES ═══════════ */}
      <div ref={facturesRef} className="pt-2">
        <div className="text-xs font-semibold mb-3" style={{ color: 'var(--gold)' }}>Factures</div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files) }}
          onClick={() => uploading === 0 && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            dragOver ? 'border-amber-400 bg-amber-400/5 scale-[1.01]' : 'border-stone-700 hover:border-stone-500 hover:bg-stone-900/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={e => e.target.files && processFiles(e.target.files)}
          />
          {uploading > 0 ? (
            <div className="text-amber-400">
              <div className="text-3xl mb-2 animate-pulse">⏳</div>
              <div className="font-medium text-sm">L'IA analyse {uploading > 1 ? `${uploading} factures` : 'ta facture'}...</div>
            </div>
          ) : (
            <div className="text-stone-400">
              <div className="text-4xl mb-3">📄</div>
              <div className="font-semibold text-stone-200">Dépose tes factures ici</div>
              <div className="text-xs mt-1 text-stone-500">PDF ou photo · plusieurs d'un coup</div>
            </div>
          )}
        </div>

        {/* Upload feedback */}
        {feedback.length > 0 && (
          <div className="space-y-1 mt-2">
            {feedback.map((f, i) => (
              <div
                key={i}
                className="text-xs px-3 py-2 rounded-lg"
                style={{
                  background: f.type === 'ok' ? 'rgba(74,222,128,0.1)' : f.type === 'dup' ? 'rgba(212,165,116,0.1)' : 'rgba(248,113,113,0.1)',
                  color: f.type === 'ok' ? '#4ade80' : f.type === 'dup' ? 'var(--gold)' : '#f87171',
                }}
              >
                {f.type === 'dup' ? '⚠️ Doublon : ' : f.type === 'ok' ? '✓ ' : '✗ '}{f.text}
              </div>
            ))}
          </div>
        )}

        {/* Invoice list */}
        {loadingInv ? (
          <div className="text-center text-stone-500 py-6">Chargement...</div>
        ) : invoices.length > 0 && (
          <div className="card !p-0 overflow-hidden mt-3">
            <div className="px-4 py-3 border-b border-stone-800 flex justify-between items-center">
              <h3 className="text-stone-200 font-semibold text-sm">{invoices.length} facture{invoices.length > 1 ? 's' : ''}</h3>
              <span className="text-red-400 font-bold text-sm">{totalExpenses.toFixed(0)} € TTC</span>
            </div>
            <div className="divide-y divide-stone-800/60">
              {invoices.map(inv => (
                <div key={inv.id} className="px-4 py-3 hover:bg-stone-800/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-stone-200 font-medium text-sm">{inv.fournisseur}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORIES_COLORS[inv.categorie] || 'bg-stone-700 text-stone-300'}`}>
                        {inv.categorie}
                      </span>
                    </div>
                    <div className="text-right">
                      {inv.montant_ht > 0 && <div className="text-stone-500 text-xs">{inv.montant_ht.toFixed(2)} € HT</div>}
                      <div className="text-red-400 font-bold text-sm">{inv.montant_ttc.toFixed(2)} €</div>
                    </div>
                  </div>
                  {inv.description && <div className="text-stone-500 text-xs mt-1">{inv.description}</div>}
                  <div className="text-stone-600 text-xs mt-0.5">{inv.date || 'Date non détectée'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
