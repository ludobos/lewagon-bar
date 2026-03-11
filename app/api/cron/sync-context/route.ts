import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { fetchJoursFeries } from '@/lib/open-data/jours-feries'
import { fetchVacancesScolaires } from '@/lib/open-data/vacances-scolaires'
import { fetchNantesEvents } from '@/lib/open-data/nantes-events'
import { fetchNantesTravaux } from '@/lib/open-data/nantes-travaux'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request) {
  // Vérification CRON_SECRET (Vercel cron ou appel manuel admin)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const results: Record<string, { ok: number; errors: number }> = {}

  const tasks = await Promise.allSettled([
    // Jours fériés
    (async () => {
      const feries = await fetchJoursFeries()
      let ok = 0, errors = 0
      for (const f of feries) {
        try {
          await sql`
            INSERT INTO events (date, type, description, impact, source, external_id)
            VALUES (${f.date}, 'jour-ferie', ${f.label}, ${f.impact}, 'gouv.fr', ${f.external_id})
            ON CONFLICT (external_id) WHERE external_id IS NOT NULL
            DO UPDATE SET description = EXCLUDED.description
          `
          ok++
        } catch { errors++ }
      }
      results['jours-feries'] = { ok, errors }
    })(),

    // Vacances scolaires
    (async () => {
      const vacances = await fetchVacancesScolaires()
      let ok = 0, errors = 0
      for (const v of vacances) {
        try {
          await sql`
            INSERT INTO events (date, type, description, impact, source, external_id, date_fin)
            VALUES (${v.date_debut}, 'vacances-scolaires', ${v.description}, ${v.impact}, 'education.gouv.fr', ${v.external_id}, ${v.date_fin})
            ON CONFLICT (external_id) WHERE external_id IS NOT NULL
            DO UPDATE SET description = EXCLUDED.description, date_fin = EXCLUDED.date_fin
          `
          ok++
        } catch { errors++ }
      }
      results['vacances'] = { ok, errors }
    })(),

    // Événements Nantes
    (async () => {
      const events = await fetchNantesEvents()
      let ok = 0, errors = 0
      for (const e of events) {
        try {
          await sql`
            INSERT INTO events (date, type, description, impact, source, external_id, date_fin, raw_data)
            VALUES (${e.date}, 'evenement', ${e.description}, ${e.impact}, 'nantes-metropole', ${e.external_id}, ${e.date_fin}, ${JSON.stringify(e.raw_data)})
            ON CONFLICT (external_id) WHERE external_id IS NOT NULL
            DO UPDATE SET description = EXCLUDED.description, date_fin = EXCLUDED.date_fin
          `
          ok++
        } catch { errors++ }
      }
      results['nantes-events'] = { ok, errors }
    })(),

    // Travaux / trafic
    (async () => {
      const travaux = await fetchNantesTravaux()
      let ok = 0, errors = 0
      for (const t of travaux) {
        try {
          await sql`
            INSERT INTO events (date, type, description, impact, source, external_id, date_fin, raw_data)
            VALUES (${t.date}, 'travaux-voirie', ${t.description}, ${t.impact}, 'nantes-metropole', ${t.external_id}, ${t.date_fin}, ${JSON.stringify(t.raw_data)})
            ON CONFLICT (external_id) WHERE external_id IS NOT NULL
            DO UPDATE SET description = EXCLUDED.description, date_fin = EXCLUDED.date_fin
          `
          ok++
        } catch { errors++ }
      }
      results['travaux'] = { ok, errors }
    })(),
  ])

  // Nettoyage events auto > 60 jours passés
  let cleaned = 0
  try {
    const res = await sql`
      DELETE FROM events
      WHERE external_id IS NOT NULL
        AND date < CURRENT_DATE - INTERVAL '60 days'
        AND (date_fin IS NULL OR date_fin < CURRENT_DATE - INTERVAL '60 days')
    `
    cleaned = res.rowCount || 0
  } catch {}

  // Log sync
  const totalOk = Object.values(results).reduce((s, r) => s + r.ok, 0)
  const totalErrors = Object.values(results).reduce((s, r) => s + r.errors, 0)
  try {
    await sql`
      INSERT INTO sync_log (source, status, message, records)
      VALUES ('sync-context', ${totalErrors > 0 ? 'partial' : 'success'},
              ${JSON.stringify(results)}, ${totalOk})
    `
  } catch {}

  return NextResponse.json({
    results,
    cleaned,
    total: totalOk,
    errors: totalErrors,
  })
}
