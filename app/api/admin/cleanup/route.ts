import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { action } = await req.json()

  if (action === 'remove_manual_transactions') {
    // Count before
    const { rows: before } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE sumup_id IS NULL) AS manual,
        COUNT(*) FILTER (WHERE sumup_id IS NOT NULL) AS sumup,
        COUNT(*) AS total
      FROM transactions
    `

    // Delete manual entries
    const { rowCount } = await sql`DELETE FROM transactions WHERE sumup_id IS NULL`

    return NextResponse.json({
      ok: true,
      deleted: rowCount,
      before: before[0],
    })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
