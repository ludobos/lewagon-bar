'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type Invoice = { id: number; fournisseur: string; date: string; montant_ht: number; montant_ttc: number; categorie: string; description: string; filename: string }

const CATEGORIES_COLORS: Record<string, string> = {
  boissons: 'bg-amber-500/20 text-amber-300',
  food: 'bg-emerald-500/20 text-emerald-300',
  charges: 'bg-red-500/20 text-red-300',
  materiel: 'bg-blue-500/20 text-blue-300',
  autres: 'bg-stone-600/40 text-stone-300',
}

export default function FacturesTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loadingInv, setLoadingInv] = useState(true)
  const [uploading, setUploading] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'dup' | 'err'; text: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/invoices')
      .then(r => r.ok ? r.json() : { invoices: [] })
      .then(data => setInvoices(data.invoices || []))
      .finally(() => setLoadingInv(false))
  }, [])

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

  return (
    <div className="space-y-3">
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
        <div className="space-y-1">
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
        <div className="card !p-0 overflow-hidden">
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
  )
}
