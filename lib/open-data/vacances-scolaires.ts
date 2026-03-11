export type VacancesScolaires = {
  date_debut: string
  date_fin: string
  description: string
  external_id: string
  impact: 'positif'
}

export async function fetchVacancesScolaires(): Promise<VacancesScolaires[]> {
  const now = new Date()
  const yearStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  const anneeScolaire = `${yearStart}-${yearStart + 1}`

  const params = new URLSearchParams({
    where: `location="Nantes" AND annee_scolaire="${anneeScolaire}"`,
    order_by: 'start_date',
    limit: '20',
  })

  const res = await fetch(
    `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?${params}`
  )
  if (!res.ok) return []

  const data = await res.json()
  const results: VacancesScolaires[] = []

  for (const record of data.results || []) {
    const dateDebut = record.start_date?.slice(0, 10)
    const dateFin = record.end_date?.slice(0, 10)
    const desc = record.description || 'Vacances scolaires'

    if (!dateDebut || !dateFin) continue

    results.push({
      date_debut: dateDebut,
      date_fin: dateFin,
      description: `${desc} (Zone B)`,
      external_id: `vacances:${dateDebut}:${dateFin}`,
      impact: 'positif',
    })
  }

  return results
}
