export type JourFerie = {
  date: string
  label: string
  external_id: string
  impact: 'positif'
}

export async function fetchJoursFeries(): Promise<JourFerie[]> {
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear + 1]
  const results: JourFerie[] = []

  for (const year of years) {
    const res = await fetch(`https://calendrier.api.gouv.fr/jours-feries/metropole/${year}.json`)
    if (!res.ok) continue

    const data: Record<string, string> = await res.json()

    for (const [date, label] of Object.entries(data)) {
      results.push({
        date,
        label,
        external_id: `jours-feries:${date}`,
        impact: 'positif',
      })
    }
  }

  return results
}
