'use client'

import { useState } from 'react'

type ImpactData = {
  periode_travaux: { debut: string; fin: string; jours: number }
  periode_baseline: { debut: string; fin: string; jours: number }
  ca_travaux: number
  ca_baseline: number
  moyenne_travaux: number
  moyenne_baseline: number
  perte_euros: number
  perte_pourcent: number
  seuil_atteint: boolean
  par_semaine: { semaine: string; baseline: number; travaux: number }[]
}

function suggestBaseline(debut: string, fin: string): { baselineDebut: string; baselineFin: string } {
  const d = new Date(debut)
  const f = new Date(fin)
  const dureeMs = f.getTime() - d.getTime()

  // Même période l'année précédente
  const bDebut = new Date(d)
  bDebut.setFullYear(bDebut.getFullYear() - 1)
  const bFin = new Date(bDebut.getTime() + dureeMs)

  return {
    baselineDebut: bDebut.toISOString().slice(0, 10),
    baselineFin: bFin.toISOString().slice(0, 10),
  }
}

export default function TravauxPage() {
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [baselineDebut, setBaselineDebut] = useState('')
  const [baselineFin, setBaselineFin] = useState('')
  const [maitreOuvrage, setMaitreOuvrage] = useState('Nantes Métropole')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ImpactData | null>(null)
  const [error, setError] = useState('')

  const handleDateChange = (debut: string, fin: string) => {
    setDateDebut(debut)
    setDateFin(fin)
    if (debut && fin) {
      const suggested = suggestBaseline(debut, fin)
      setBaselineDebut(suggested.baselineDebut)
      setBaselineFin(suggested.baselineFin)
    }
  }

  const calculer = async () => {
    if (!dateDebut || !dateFin || !baselineDebut || !baselineFin) return
    setLoading(true)
    setError('')
    setData(null)

    try {
      const params = new URLSearchParams({
        date_debut: dateDebut,
        date_fin: dateFin,
        baseline_debut: baselineDebut,
        baseline_fin: baselineFin,
      })
      const res = await fetch(`/api/reports/impact-travaux?${params}`)
      if (!res.ok) throw new Error('Erreur calcul')
      const result = await res.json()
      setData(result)
    } catch {
      setError('Erreur lors du calcul. Vérifie les dates.')
    }
    setLoading(false)
  }

  const openPdf = () => {
    const params = new URLSearchParams({
      date_debut: dateDebut,
      date_fin: dateFin,
      baseline_debut: baselineDebut,
      baseline_fin: baselineFin,
      maitre_ouvrage: maitreOuvrage,
    })
    window.open(`/api/reports/compensation-pdf?${params}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <h1 className="playfair text-lg font-bold" style={{ color: 'var(--gold)' }}>Impact travaux</h1>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Compare le CA pendant les travaux avec une période de référence pour évaluer la perte.
      </p>

      {/* Formulaire */}
      <div className="card space-y-3">
        <div className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>Période de travaux</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Début</label>
            <input type="date" value={dateDebut}
              onChange={e => handleDateChange(e.target.value, dateFin)}
              className="input !py-2 !text-sm" />
          </div>
          <div>
            <label className="label">Fin</label>
            <input type="date" value={dateFin}
              onChange={e => handleDateChange(dateDebut, e.target.value)}
              className="input !py-2 !text-sm" />
          </div>
        </div>

        <div className="text-xs font-semibold mt-2" style={{ color: 'var(--text-muted)' }}>
          Période de référence
          <span className="font-normal ml-1">(auto: même période année précédente)</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Début réf.</label>
            <input type="date" value={baselineDebut}
              onChange={e => setBaselineDebut(e.target.value)}
              className="input !py-2 !text-sm" />
          </div>
          <div>
            <label className="label">Fin réf.</label>
            <input type="date" value={baselineFin}
              onChange={e => setBaselineFin(e.target.value)}
              className="input !py-2 !text-sm" />
          </div>
        </div>

        <div>
          <label className="label">Maître d'ouvrage</label>
          <input type="text" value={maitreOuvrage}
            onChange={e => setMaitreOuvrage(e.target.value)}
            className="input !py-2 !text-sm" />
        </div>

        <button onClick={calculer}
          disabled={loading || !dateDebut || !dateFin || !baselineDebut || !baselineFin}
          className="btn-primary w-full !py-2 text-sm">
          {loading ? 'Calcul en cours...' : 'Calculer l\'impact'}
        </button>
      </div>

      {error && (
        <div className="card !p-3 text-sm" style={{ color: '#c93545' }}>{error}</div>
      )}

      {/* Résultats */}
      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="card !p-3 text-center">
              <div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>CA/jour référence</div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{data.moyenne_baseline}€</div>
            </div>
            <div className="card !p-3 text-center">
              <div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>CA/jour travaux</div>
              <div className="text-lg font-bold" style={{ color: '#c93545' }}>{data.moyenne_travaux}€</div>
            </div>
          </div>

          {/* Perte */}
          <div className="card !p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Perte estimée</div>
                <div className="text-xl font-bold" style={{ color: '#c93545' }}>
                  -{data.perte_pourcent}% ({data.perte_euros.toLocaleString('fr-FR')}€)
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Seuil 37%</div>
                <div className="text-sm font-bold" style={{
                  color: data.seuil_atteint ? '#4ade80' : '#f59e0b',
                }}>
                  {data.seuil_atteint ? 'ATTEINT' : 'NON ATTEINT'}
                </div>
              </div>
            </div>

            {/* Barre visuelle */}
            <div className="mt-3">
              <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
                <span>0%</span>
                <span style={{ color: '#f59e0b' }}>37%</span>
                <span>100%</span>
              </div>
              <div className="h-3 rounded-full relative" style={{ background: '#333' }}>
                <div className="absolute left-[37%] top-0 bottom-0 w-px" style={{ background: '#f59e0b' }} />
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(data.perte_pourcent, 100)}%`,
                    background: data.seuil_atteint ? '#4ade80' : '#c93545',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Tableau par semaine */}
          {data.par_semaine.length > 0 && (
            <div className="card !p-3">
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--gold)' }}>Comparaison par semaine</div>
              <div className="space-y-1">
                {data.par_semaine.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1" style={{ borderBottom: '1px solid #333' }}>
                    <span className="w-16" style={{ color: 'var(--text-muted)' }}>{s.semaine}</span>
                    <div className="flex-1">
                      <div className="flex gap-1 items-center">
                        <div className="h-2 rounded" style={{ width: `${s.baseline > 0 ? 100 : 0}%`, background: '#4ade8044', minWidth: '2px' }} />
                        <span style={{ color: 'var(--text-muted)' }}>{s.baseline}€</span>
                      </div>
                      <div className="flex gap-1 items-center">
                        <div className="h-2 rounded" style={{ width: `${s.baseline > 0 ? (s.travaux / s.baseline * 100) : 0}%`, background: '#c9354544', minWidth: '2px' }} />
                        <span style={{ color: '#c93545' }}>{s.travaux}€</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bouton PDF */}
          <button onClick={openPdf} className="btn-primary w-full !py-3 text-sm">
            Générer le rapport HTML (imprimable)
          </button>

          {/* Procédure */}
          <div className="card !p-3 space-y-2">
            <div className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>Procédure</div>
            <ol className="text-xs space-y-1.5 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
              <li>Génère le rapport ci-dessus</li>
              <li>Imprime-le (Ctrl+P depuis la page HTML)</li>
              <li>Envoie en lettre recommandée AR à {maitreOuvrage}</li>
              <li>Délai de réponse : 2 mois</li>
              <li>Sans réponse → tribunal administratif</li>
              <li>Prescription : 4 ans (1er janvier suivant le dommage)</li>
            </ol>
          </div>
        </>
      )}
    </div>
  )
}
