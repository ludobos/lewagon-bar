import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { insertTransaction, getTransactionsByMonth } from '@/lib/db/transactions'

export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
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
