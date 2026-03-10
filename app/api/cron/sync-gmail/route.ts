import { NextResponse } from 'next/server'
import { syncInvoices } from '@/lib/gmail'

// Vercel cron: runs every morning at 08:00 Paris time
// vercel.json: { "crons": [{ "path": "/api/cron/sync-gmail", "schedule": "0 7 * * *" }] }

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const processed = await syncInvoices()
    return NextResponse.json({ ok: true, processed })
  } catch (err: any) {
    console.error('Gmail sync error:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
