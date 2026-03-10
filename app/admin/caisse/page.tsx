'use client'

import { useState, useEffect, useCallback } from 'react'

type Transaction = {
  id: string
  date: string
  amount: string
  payment_type: string
  note: string | null
  sumup_id: string | null
}

export default function CaissePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [paymentType, setPaymentType] = useState('cash')

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const res = await fetch(`/api/transactions?year=${year}&month=${month}`)
    if (res.ok) {
      const data = await res.json()
      setTransactions(data.transactions || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setSaving(true)
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, date, payment_type: paymentType }),
    })
    setAmount('')
    setDate(today)
    setPaymentType('cash')
    setShowForm(false)
    setSaving(false)
    loadTransactions()
  }

  const total = transactions.reduce((s, t) => s + parseFloat(t.amount), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="playfair text-lg font-bold" style={{ color: 'var(--gold)' }}>Caisse</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-sm !py-2 !px-4"
        >
          {showForm ? 'Annuler' : '+ Ajouter'}
        </button>
      </div>

      {/* Formulaire saisie */}
      {showForm && (
        <div className="card space-y-4">
          <div>
            <label className="label">Montant (€)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0,00"
              className="input text-2xl font-bold text-center"
              autoFocus
            />
          </div>

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
            <label className="label">Paiement</label>
            <div className="flex gap-2">
              {(['cash', 'card', 'autre'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setPaymentType(type)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    paymentType === type
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-800 text-stone-400 border border-stone-700'
                  }`}
                >
                  {type === 'cash' ? 'Espèces' : type === 'card' ? 'CB' : 'Autre'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving || !amount}
            className="btn-primary w-full"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      )}

      {/* Total du mois */}
      <div className="card flex justify-between items-center">
        <span className="text-stone-400 text-sm">Total du mois</span>
        <span className="text-lg font-bold text-amber-400">
          {Math.round(total).toLocaleString('fr-FR')} €
        </span>
      </div>

      {/* Liste transactions */}
      {loading ? (
        <div className="text-center text-stone-500 py-8">Chargement...</div>
      ) : transactions.length === 0 ? (
        <div className="card text-center text-stone-500 py-8">Aucune vente ce mois</div>
      ) : (
        <div className="space-y-2">
          {[...transactions].reverse().map(tx => (
            <div key={tx.id} className="card !p-3 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">
                  {parseFloat(tx.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </div>
                <div className="text-xs text-stone-500">
                  {new Date(tx.date).toLocaleDateString('fr-FR', {
                    weekday: 'short', day: 'numeric', month: 'short'
                  })}
                  {tx.note && ` — ${tx.note}`}
                </div>
              </div>
              <div className="text-xs text-stone-600">
                {tx.payment_type === 'cash' ? 'Espèces' : tx.payment_type === 'card' ? 'CB' : tx.payment_type || ''}
                {tx.sumup_id && ' · SumUp'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
