import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { rows } = await sql`
    SELECT id, date::text, type, description, impact, source, external_id, date_fin::text
    FROM events
    WHERE date >= CURRENT_DATE - INTERVAL '7 days'
      OR (date_fin IS NOT NULL AND date_fin >= CURRENT_DATE - INTERVAL '7 days')
    ORDER BY date ASC
    LIMIT 100
  `
  return NextResponse.json({ events: rows })
}

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { date, type, description, impact } = await req.json()
  if (!date || !description) {
    return NextResponse.json({ error: 'Date et description requises' }, { status: 400 })
  }

  const { rows } = await sql`
    INSERT INTO events (date, type, description, impact, source)
    VALUES (${date}, ${type || 'autre'}, ${description}, ${impact || 'neutre'}, 'manual')
    RETURNING id, date::text, type, description, impact, source
  `
  return NextResponse.json({ event: rows[0] })
}
