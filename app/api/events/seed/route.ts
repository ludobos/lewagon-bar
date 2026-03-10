import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

// Événements récurrents Nantes centre — 2 prochaines semaines
function getUpcomingEvents(): { date: string; type: string; description: string; impact: string }[] {
  const events: { date: string; type: string; description: string; impact: string }[] = []
  const today = new Date()

  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dow = d.getDay()
    const dateStr = d.toISOString().slice(0, 10)
    const month = d.getMonth() + 1
    const day = d.getDate()

    // Samedi : Marché Petite Hollande (7h-15h)
    if (dow === 6) {
      events.push({
        date: dateStr,
        type: 'evenement',
        description: 'Marché Petite Hollande (7h-15h) — afflux piétons quai',
        impact: 'positif',
      })
    }

    // Vendredi soir : afterwork quai de la Fosse
    if (dow === 5) {
      events.push({
        date: dateStr,
        type: 'evenement',
        description: 'Vendredi soir — afterwork bureaux du quai',
        impact: 'positif',
      })
    }

    // Dimanche + Lundi : bar fermé
    if (dow === 0 || dow === 1) {
      events.push({
        date: dateStr,
        type: 'fermeture',
        description: dow === 0 ? 'Dimanche — fermé' : 'Lundi — fermé',
        impact: 'neutre',
      })
    }

    // Mars-Avril : Printemps, début terrasse
    if (month === 3 && day >= 20 && day <= 21) {
      events.push({
        date: dateStr,
        type: 'meteo',
        description: 'Équinoxe de printemps — début saison terrasse',
        impact: 'positif',
      })
    }

    // Ramadan 2026 : ~17 fév - 19 mars 2026
    if ((month === 2 && day >= 17) || (month === 3 && day <= 19)) {
      // Only add once at start
      if (month === 3 && day === 10) {
        events.push({
          date: dateStr,
          type: 'ramadan',
          description: 'Ramadan en cours (fin ~19 mars) — impact soirées',
          impact: 'negatif',
        })
      }
    }

    // Fin Ramadan / Aïd
    if (month === 3 && day >= 19 && day <= 20) {
      events.push({
        date: dateStr,
        type: 'ramadan',
        description: 'Fin du Ramadan / Aïd el-Fitr — retour clientèle soirée',
        impact: 'positif',
      })
    }
  }

  return events
}

export async function POST() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const events = getUpcomingEvents()
  let added = 0

  for (const e of events) {
    try {
      // Avoid duplicates by checking date + description
      const existing = await sql`
        SELECT id FROM events WHERE date = ${e.date} AND description = ${e.description}
      `
      if (existing.rows.length === 0) {
        await sql`
          INSERT INTO events (date, type, description, impact, source)
          VALUES (${e.date}, ${e.type}, ${e.description}, ${e.impact}, 'auto')
        `
        added++
      }
    } catch {
      // skip duplicates
    }
  }

  return NextResponse.json({ added, total: events.length })
}
