import { NextResponse } from 'next/server'
import { syncTransactions } from '@/lib/sumup'

// Vercel cron: runs every night at 23:00 Paris time
// vercel.json: { "crons": [{ "path": "/api/cron/sync-sumup", "schedule": "0 22 * * *" }] }

export async function GET(req: Request) {
  // Protect cron endpoint
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const inserted = await syncTransactions(1)
    return NextResponse.json({ ok: true, inserted })
  } catch (err: any) {
    console.error('SumUp sync error:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
