import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateDebut = searchParams.get('date_debut')
  const dateFin = searchParams.get('date_fin')
  const baselineDebut = searchParams.get('baseline_debut')
  const baselineFin = searchParams.get('baseline_fin')

  if (!dateDebut || !dateFin || !baselineDebut || !baselineFin) {
    return NextResponse.json({ error: 'Paramètres requis: date_debut, date_fin, baseline_debut, baseline_fin' }, { status: 400 })
  }

  // CA pendant travaux
  const { rows: travauxRows } = await sql`
    SELECT date::text, SUM(amount)::float AS ca
    FROM transactions
    WHERE status = 'successful' AND date >= ${dateDebut} AND date <= ${dateFin}
    GROUP BY date ORDER BY date ASC
  `

  // CA baseline (référence)
  const { rows: baselineRows } = await sql`
    SELECT date::text, SUM(amount)::float AS ca
    FROM transactions
    WHERE status = 'successful' AND date >= ${baselineDebut} AND date <= ${baselineFin}
    GROUP BY date ORDER BY date ASC
  `

  const travauxTotal = travauxRows.reduce((s, r) => s + (r.ca || 0), 0)
  const baselineTotal = baselineRows.reduce((s, r) => s + (r.ca || 0), 0)
  const travauxJours = travauxRows.length || 1
  const baselineJours = baselineRows.length || 1

  const moyenneTravaux = travauxTotal / travauxJours
  const moyenneBaseline = baselineTotal / baselineJours

  const perteAbsolue = (moyenneBaseline - moyenneTravaux) * travauxJours
  const pertePourcent = moyenneBaseline > 0
    ? ((moyenneBaseline - moyenneTravaux) / moyenneBaseline) * 100
    : 0

  const seuilAtteint = pertePourcent >= 37

  // Résumé par semaine
  const parSemaine: { semaine: string; baseline: number; travaux: number }[] = []
  const weekStart = (dateStr: string) => {
    const d = new Date(dateStr)
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d.toISOString().slice(0, 10)
  }

  const travauxParSemaine: Record<string, number[]> = {}
  for (const r of travauxRows) {
    const w = weekStart(r.date)
    if (!travauxParSemaine[w]) travauxParSemaine[w] = []
    travauxParSemaine[w].push(r.ca)
  }

  const baselineParSemaine: Record<string, number[]> = {}
  for (const r of baselineRows) {
    const w = weekStart(r.date)
    if (!baselineParSemaine[w]) baselineParSemaine[w] = []
    baselineParSemaine[w].push(r.ca)
  }

  const travauxSemaines = Object.keys(travauxParSemaine).sort()
  const baselineSemaines = Object.keys(baselineParSemaine).sort()
  const maxWeeks = Math.max(travauxSemaines.length, baselineSemaines.length)

  for (let i = 0; i < maxWeeks; i++) {
    const tValues = travauxParSemaine[travauxSemaines[i]] || []
    const bValues = baselineParSemaine[baselineSemaines[i]] || []
    parSemaine.push({
      semaine: `Sem. ${i + 1}`,
      travaux: Math.round(tValues.reduce((s, v) => s + v, 0)),
      baseline: Math.round(bValues.reduce((s, v) => s + v, 0)),
    })
  }

  return NextResponse.json({
    periode_travaux: { debut: dateDebut, fin: dateFin, jours: travauxJours },
    periode_baseline: { debut: baselineDebut, fin: baselineFin, jours: baselineJours },
    ca_travaux: Math.round(travauxTotal),
    ca_baseline: Math.round(baselineTotal),
    moyenne_travaux: Math.round(moyenneTravaux),
    moyenne_baseline: Math.round(moyenneBaseline),
    perte_euros: Math.round(perteAbsolue),
    perte_pourcent: Math.round(pertePourcent * 10) / 10,
    seuil_atteint: seuilAtteint,
    par_semaine: parSemaine,
    detail_travaux: travauxRows,
    detail_baseline: baselineRows,
  })
}
