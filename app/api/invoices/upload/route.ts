import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const isPdf = file.type === 'application/pdf'
  const mediaType = file.type || 'image/jpeg'

  let extracted = {
    fournisseur: file.name.replace(/\.[^.]+$/, ''),
    date: '',
    montant_ht: 0,
    montant_ttc: 0,
    categorie: 'autres',
    description: 'Extraction échouée — saisie manuelle requise',
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          {
            type: isPdf ? 'document' : 'image',
            source: {
              type: 'base64',
              media_type: mediaType as any,
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Analyse cette facture de bar/restaurant. Réponds UNIQUEMENT en JSON valide, sans markdown: {"fournisseur": "nom", "date": "YYYY-MM-DD ou vide", "montant_ht": 0, "montant_ttc": 0, "categorie": "boissons|food|charges|materiel|autres", "description": "articles principaux en 1 ligne"}',
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text'
      ? response.content[0].text.replace(/```json|```/g, '').trim()
      : ''
    if (text) {
      extracted = JSON.parse(text)
    }
  } catch {
    // keep default extracted values
  }

  const { rows } = await sql`
    INSERT INTO invoices (fournisseur, date_facture, montant_ht, montant_ttc, categorie, description, filename)
    VALUES (
      ${extracted.fournisseur},
      ${extracted.date || null},
      ${extracted.montant_ht || 0},
      ${extracted.montant_ttc || 0},
      ${extracted.categorie || 'autres'},
      ${extracted.description || ''},
      ${file.name}
    )
    RETURNING id, fournisseur, date_facture::text AS date, montant_ht::float, montant_ttc::float, categorie, description, filename
  `

  return NextResponse.json({ invoice: rows[0] })
}
