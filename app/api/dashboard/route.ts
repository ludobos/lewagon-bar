import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const [statsResult, daysResult, weekdayResult, eventsResult, settingsResult] = await Promise.all([
    sql`
      SELECT
        COUNT(*) AS nb_jours,
        COALESCE(SUM(amount), 0)::float AS ca_total,
        COALESCE(AVG(amount), 0)::float AS ca_moyen,
        COALESCE(MAX(amount), 0)::float AS ca_max,
        COALESCE(MIN(amount), 0)::float AS ca_min
      FROM (
        SELECT date, SUM(amount) AS amount
        FROM transactions
        WHERE status = 'successful'
        GROUP BY date
      ) t
    `,
    sql`
      SELECT date::text, SUM(amount)::float AS ca
      FROM transactions
      WHERE status = 'successful'
        AND date >= CURRENT_DATE - INTERVAL '21 days'
      GROUP BY date
      ORDER BY date ASC
    `,
    // CA moyen par jour de la semaine
    sql`
      SELECT
        EXTRACT(DOW FROM date)::int AS dow,
        AVG(daily_ca)::float AS ca_moyen,
        COUNT(*)::int AS nb_jours
      FROM (
        SELECT date, SUM(amount) AS daily_ca
        FROM transactions
        WHERE status = 'successful'
        GROUP BY date
      ) t
      GROUP BY EXTRACT(DOW FROM date)
      ORDER BY EXTRACT(DOW FROM date)
    `,
    sql`
      SELECT date::text, type, description, impact
      FROM events
      WHERE date >= CURRENT_DATE - INTERVAL '7 days'
        AND date <= CURRENT_DATE + INTERVAL '14 days'
      ORDER BY date ASC
      LIMIT 10
    `,
    sql`SELECT value FROM settings WHERE key = 'daily_target'`.catch(() => ({ rows: [] })),
  ])

  const target = parseInt(settingsResult.rows[0]?.value || '500')

  // Count days above target
  const joursObjResult = await sql`
    SELECT COUNT(*)::int AS jours_objectif
    FROM (
      SELECT date, SUM(amount) AS amount
      FROM transactions
      WHERE status = 'successful'
      GROUP BY date
      HAVING SUM(amount) >= ${target}
    ) t
  `

  // Yesterday's CA
  const yesterdayResult = await sql`
    SELECT COALESCE(SUM(amount), 0)::float AS ca
    FROM transactions
    WHERE status = 'successful'
      AND date = CURRENT_DATE - INTERVAL '1 day'
  `

  return NextResponse.json({
    stats: {
      ...statsResult.rows[0],
      jours_objectif: joursObjResult.rows[0].jours_objectif,
    },
    yesterday: yesterdayResult.rows[0]?.ca || 0,
    days: daysResult.rows,
    weekday_pattern: weekdayResult.rows,
    events: eventsResult.rows,
    target,
  })
}
