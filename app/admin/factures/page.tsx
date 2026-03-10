'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

const CATEGORIES_COLORS: Record<string, string> = {
  boissons: 'bg-amber-500/20 text-amber-300',
  food: 'bg-emerald-500/20 text-emerald-300',
  charges: 'bg-red-500/20 text-red-300',
  materiel: 'bg-blue-500/20 text-blue-300',
  autres: 'bg-stone-600/40 text-stone-300',
}

type Invoice = {
  id: number
  fournisseur: string
  date: string
  montant_ht: number
  montant_ttc: number
  categorie: string
  description: string
  filename: string
}

export default function FacturesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/invoices')
      .then(r => r.ok ? r.json() : { invoices: [] })
      .then(data => setInvoices(data.invoices || []))
      .finally(() => setLoading(false))
  }, [])

  const processFile = useCallback(async (file: File) => {
    if (!file) return
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.invoice) {
        setInvoices(prev => [data.invoice, ...prev])
      }
    } catch {
      // silently fail
    }
    setUploading(false)
  }, [])

  const totalExpenses = invoices.reduce((s, i) => s + (i.montant_ttc || 0), 0)

  return (
    <div className="space-y-5">
      <h1 className="playfair text-xl font-bold text-amber-400">Factures</h1>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          dragOver ? 'border-amber-400 bg-amber-400/5 scale-[1.01]' : 'border-stone-700 hover:border-stone-500 hover:bg-stone-900/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={e => e.target.files?.[0] && processFile(e.target.files[0])}
        />
        {uploading ? (
          <div className="text-amber-400">
            <div className="text-4xl mb-3 animate-pulse">⏳</div>
            <div className="font-medium">L'IA analyse ta facture...</div>
            <div className="text-stone-500 text-sm mt-1">Extraction des montants, fournisseur, catégorie</div>
          </div>
        ) : (
          <div className="text-stone-400">
            <div className="text-5xl mb-4">📄</div>
            <div className="font-semibold text-stone-200 text-lg">Dépose ta facture ici</div>
            <div className="text-sm mt-2">PDF ou photo — L'IA extrait tout automatiquement</div>
            <div className="text-xs mt-1 text-stone-600">ABN, Promocash, EDF, loyer...</div>
          </div>
        )}
      </div>

      {/* Invoice list */}
      {loading ? (
        <div className="text-center text-stone-500 py-8">Chargement...</div>
      ) : invoices.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-800 flex justify-between items-center">
            <h3 className="text-stone-200 font-semibold">{invoices.length} facture{invoices.length > 1 ? 's' : ''}</h3>
            <span className="text-red-400 font-bold">{totalExpenses.toFixed(0)} € TTC</span>
          </div>
          <div className="divide-y divide-stone-800/60">
            {invoices.map(inv => (
              <div key={inv.id} className="px-5 py-4 hover:bg-stone-800/20 transition-colors">
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
