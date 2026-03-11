import { NextResponse } from 'next/server'
import { syncTransactions } from '@/lib/sumup'

// Vercel cron: runs every night at 23:00 Paris time
// vercel.json: { "crons": [{ "path": "/api/cron/sync-sumup", "schedule": "0 22 * * *" }] }

export async function GET(req: Request) {
  // Allow cron (with CRON_SECRET) or manual trigger (with query param)
  const authHeader = req.headers.get('authorization')
  const { searchParams } = new URL(req.url)
  const manual = searchParams.get('manual')
  const daysBack = parseInt(searchParams.get('days') || '1')

  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
  const isManual = manual === process.env.CRON_SECRET

  if (!isCron && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const inserted = await syncTransactions(daysBack)
    return NextResponse.json({ ok: true, inserted, daysBack })
  } catch (err: any) {
    console.error('SumUp sync error:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
