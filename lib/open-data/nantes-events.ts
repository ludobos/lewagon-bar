export type NantesEvent = {
  date: string
  date_fin: string | null
  description: string
  external_id: string
  impact: 'positif'
  raw_data: Record<string, unknown>
}

export async function fetchNantesEvents(): Promise<NantesEvent[]> {
  const today = new Date().toISOString().slice(0, 10)
  const in30days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const params = new URLSearchParams({
    where: `date >= "${today}" AND date <= "${in30days}"`,
    order_by: 'date',
    limit: '50',
  })

  const res = await fetch(
    `https://data.nantesmetropole.fr/api/explore/v2.1/catalog/datasets/244400404_agenda-evenements-nantes-metropole_v2/records?${params}`
  )
  if (!res.ok) return []

  const data = await res.json()
  const results: NantesEvent[] = []

  for (const record of data.results || []) {
    const dateStr = record.date?.slice(0, 10)
    if (!dateStr) continue

    const nom = record.nom || 'Événement Nantes'
    const lieu = record.lieu || ''
    const description = lieu ? `${nom} — ${lieu}` : nom

    results.push({
      date: dateStr,
      date_fin: null,
      description: description.slice(0, 200),
      external_id: `nantes:${record.id_manif || record.id || dateStr + ':' + nom.slice(0, 30)}`,
      impact: 'positif',
      raw_data: record,
    })
  }

  return results
}
