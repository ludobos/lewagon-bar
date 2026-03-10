import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Create table if not exists (simple key-value settings)
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  const { rows } = await sql`SELECT key, value FROM settings`
  const settings: Record<string, string> = {}
  for (const row of rows) settings[row.key] = row.value

  return NextResponse.json({
    daily_target: parseInt(settings.daily_target || '500'),
  })
}

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()

  if (body.daily_target !== undefined) {
    await sql`
      INSERT INTO settings (key, value) VALUES ('daily_target', ${String(body.daily_target)})
      ON CONFLICT (key) DO UPDATE SET value = ${String(body.daily_target)}, updated_at = NOW()
    `
  }

  return NextResponse.json({ ok: true })
}
