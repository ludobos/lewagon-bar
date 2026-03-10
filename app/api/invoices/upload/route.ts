import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

async function extractInvoice(file: File) {
  const apiKey = process.env.ANTHROPIC_API_KEY
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

  if (!apiKey) return extracted

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: [
            {
              type: isPdf ? 'document' : 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Analyse cette facture de bar/restaurant. Réponds UNIQUEMENT en JSON valide, sans markdown: {"fournisseur": "nom", "date": "YYYY-MM-DD ou vide", "montant_ht": 0, "montant_ttc": 0, "categorie": "boissons|food|charges|materiel|autres", "description": "articles principaux en 1 ligne"}',
            },
          ],
        }],
      }),
    })

    const data = await res.json()
    const text = data.content?.[0]?.text?.replace(/```json|```/g, '').trim() || ''
    if (text) {
      extracted = JSON.parse(text)
    }
  } catch {
    // keep default extracted values
  }

  return extracted
}

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const formData = await req.formData()
  const files = formData.getAll('file') as File[]
  // Support single file too
  if (files.length === 0) {
    const singleFile = formData.get('file') as File | null
    if (singleFile) files.push(singleFile)
  }

  if (files.length === 0) {
    return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })
  }

  const results: { invoice?: any; duplicate?: boolean; filename: string; error?: string }[] = []

  for (const file of files) {
    // Check for duplicate by filename
    try {
      const { rows: existing } = await sql`
        SELECT id, fournisseur, montant_ttc::float, date_facture::text AS date
        FROM invoices WHERE filename = ${file.name} LIMIT 1
      `
      if (existing.length > 0) {
        results.push({
          filename: file.name,
          duplicate: true,
          invoice: existing[0],
        })
        continue
      }
    } catch {
      // table might not exist yet, continue
    }

    const extracted = await extractInvoice(file)

    // Also check duplicate by fournisseur + montant_ttc + date
    if (extracted.date && extracted.montant_ttc > 0) {
      try {
        const { rows: existing } = await sql`
          SELECT id FROM invoices
          WHERE fournisseur = ${extracted.fournisseur}
            AND montant_ttc = ${extracted.montant_ttc}
            AND date_facture = ${extracted.date}
          LIMIT 1
        `
        if (existing.length > 0) {
          results.push({
            filename: file.name,
            duplicate: true,
            invoice: existing[0],
          })
          continue
        }
      } catch {}
    }

    try {
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
      results.push({ filename: file.name, invoice: rows[0] })
    } catch (err: any) {
      results.push({ filename: file.name, error: err.message })
    }
  }

  // Backward compatible: if single file, return old format
  if (files.length === 1) {
    const r = results[0]
    if (r.duplicate) {
      return NextResponse.json({ duplicate: true, invoice: r.invoice, filename: r.filename })
    }
    if (r.error) {
      return NextResponse.json({ error: r.error }, { status: 500 })
    }
    return NextResponse.json({ invoice: r.invoice })
  }

  return NextResponse.json({ results })
}
