import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { insertTransaction, getTransactionsByMonth } from '@/lib/db/transactions'
import { sql } from '@vercel/postgres'

export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)

  // Mode 30 jours
  const daysParam = searchParams.get('days')
  if (daysParam) {
    const days = parseInt(daysParam) || 30
    const { rows } = await sql`
      SELECT date::text, SUM(amount)::float AS ca, COUNT(*)::int AS nb
      FROM transactions
      WHERE status = 'successful'
        AND date >= CURRENT_DATE - make_interval(days => ${days})
      GROUP BY date
      ORDER BY date ASC
    `
    return NextResponse.json({ days: rows })
  }

  // Mode mois (legacy)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
  const transactions = await getTransactionsByMonth(year, month)
  return NextResponse.json({ transactions })
}

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  if (!body.amount || !body.date) {
    return NextResponse.json({ error: 'Montant et date requis' }, { status: 400 })
  }

  const tx = await insertTransaction({
    date: body.date,
    amount: parseFloat(body.amount),
    payment_type: body.payment_type || 'cash',
    note: body.note || null,
    status: 'successful',
  })

  return NextResponse.json({ ok: true, id: tx?.id })
}
