import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { rows } = await sql`
    SELECT id, fournisseur, date_facture::text AS date, montant_ht::float, montant_ttc::float,
           categorie, description, filename
    FROM invoices
    ORDER BY created_at DESC
    LIMIT 100
  `
  return NextResponse.json({ invoices: rows })
}
