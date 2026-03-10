import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getTransactionsByMonth } from '@/lib/db/transactions'
import { getInvoicesByMonth } from '@/lib/db/invoices'
import * as XLSX from 'xlsx'

export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
  const format = searchParams.get('format') || 'excel' // 'excel' | 'csv'

  const [transactions, invoices] = await Promise.all([
    getTransactionsByMonth(year, month),
    getInvoicesByMonth(year, month),
  ])

  const monthLabel = `${year}-${String(month).padStart(2, '0')}`

  if (format === 'csv') {
    // Simple CSV for Pennylane import
    const rows = [
      ['Date', 'Type', 'Montant TTC', 'Catégorie', 'Fournisseur / Note', 'Référence'],
      // Sales
      ...transactions.map((t: any) => [
        t.date, 'Recette', t.amount, 'Ventes bar', 'SumUp', t.sumup_id || t.id
      ]),
      // Purchases
      ...invoices.map((i: any) => [
        i.date_facture, 'Achat', i.montant_ttc, i.categorie, i.fournisseur, i.id
      ]),
    ]
    const csv = rows.map(r => r.join(';')).join('\n')
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="lewagon_${monthLabel}.csv"`,
      },
    })
  }

  // Excel with 3 sheets
  const wb = XLSX.utils.book_new()

  // Sheet 1: Recettes
  const recettesData = [
    ['Date', 'CA (€)', 'Pourboire (€)', 'Mode paiement', 'Statut', 'Référence SumUp'],
    ...transactions.map((t: any) => [
      t.date, parseFloat(t.amount), parseFloat(t.tip || 0),
      t.payment_type || '', t.status || '', t.sumup_id || ''
    ]),
    [],
    ['TOTAL', transactions.reduce((s: number, t: any) => s + parseFloat(t.amount), 0), '', '', '', ''],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(recettesData)
  ws1['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Recettes')

  // Sheet 2: Achats
  const achatsData = [
    ['Date', 'Fournisseur', 'Description', 'Catégorie', 'Montant HT (€)', 'TVA (€)', 'Montant TTC (€)', 'Fichier Drive'],
    ...invoices.map((i: any) => [
      i.date_facture, i.fournisseur || '', i.description || '',
      i.categorie || '', parseFloat(i.montant_ht || 0),
      parseFloat(i.tva || 0), parseFloat(i.montant_ttc || 0),
      i.drive_url || ''
    ]),
    [],
    ['TOTAL', '', '', '',
      invoices.reduce((s: number, i: any) => s + parseFloat(i.montant_ht || 0), 0),
      invoices.reduce((s: number, i: any) => s + parseFloat(i.tva || 0), 0),
      invoices.reduce((s: number, i: any) => s + parseFloat(i.montant_ttc || 0), 0),
      ''
    ],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(achatsData)
  ws2['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Achats')

  // Sheet 3: Récap mensuel
  const caTotal = transactions.reduce((s: number, t: any) => s + parseFloat(t.amount), 0)
  const achatsTotal = invoices.reduce((s: number, i: any) => s + parseFloat(i.montant_ttc || 0), 0)
  const margeEstimee = caTotal - achatsTotal

  const byCategorie: Record<string, number> = {}
  for (const i of invoices as any[]) {
    const cat = i.categorie || 'autres'
    byCategorie[cat] = (byCategorie[cat] || 0) + parseFloat(i.montant_ttc || 0)
  }

  const recapData = [
    [`Récapitulatif — ${monthLabel}`],
    [],
    ['RECETTES', ''],
    ['CA total', caTotal],
    ['Nb transactions', transactions.length],
    ['Moyenne/jour', transactions.length > 0 ? (caTotal / transactions.length).toFixed(2) : 0],
    ['Objectif/jour', 1750],
    [],
    ['ACHATS', ''],
    ...Object.entries(byCategorie).map(([cat, total]) => [cat, total]),
    ['TOTAL ACHATS', achatsTotal],
    [],
    ['MARGE BRUTE ESTIMÉE', margeEstimee],
    ['Remboursement emprunt mensuel', 730],
    [],
    ['Généré le', new Date().toLocaleDateString('fr-FR')],
    ['Cabinet Fiteco — SARL BOSCU', ''],
  ]
  const ws3 = XLSX.utils.aoa_to_sheet(recapData)
  ws3['!cols'] = [{ wch: 35 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Récapitulatif')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="lewagon_${monthLabel}.xlsx"`,
    },
  })
}
