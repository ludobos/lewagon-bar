export type NantesTravaux = {
  date: string
  date_fin: string | null
  description: string
  external_id: string
  impact: 'negatif'
  raw_data: Record<string, unknown>
}

const MOTS_CLES_PROXIMITE = [
  'quai de la fosse',
  'fosse',
  'centre-ville',
  'centre ville',
  'commerce',
  'kervégan',
  'kervegan',
  'feydeau',
  'cours des 50 otages',
  '50 otages',
  'médiathèque',
  'bouffay',
  'île de nantes',
  'gare maritime',
  'hangar à bananes',
]

function isProximite(text: string): boolean {
  const lower = text.toLowerCase()
  return MOTS_CLES_PROXIMITE.some(mot => lower.includes(mot))
}

export async function fetchNantesTravaux(): Promise<NantesTravaux[]> {
  const params = new URLSearchParams({
    limit: '100',
  })

  const res = await fetch(
    `https://data.nantesmetropole.fr/api/explore/v2.1/catalog/datasets/244400404_alertes-info-trafic-nantes-metropole/records?${params}`
  )
  if (!res.ok) return []

  const data = await res.json()
  const results: NantesTravaux[] = []
  const today = new Date().toISOString().slice(0, 10)

  for (const record of data.results || []) {
    // Champs API : nom, detail, secteur, date_notification
    const texte = [
      record.nom || '',
      record.detail || '',
      record.secteur || '',
    ].join(' ')

    if (!isProximite(texte)) continue

    const dateStr = record.date_notification?.slice(0, 10) || today
    const desc = record.nom || 'Alerte trafic Nantes'

    results.push({
      date: dateStr,
      date_fin: null,
      description: desc.slice(0, 200),
      external_id: `travaux:${dateStr}:${desc.slice(0, 50)}`,
      impact: 'negatif',
      raw_data: record,
    })
  }

  return results
}
