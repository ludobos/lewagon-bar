import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    // Get articles from transaction_items (100% coverage via receipts API)
    const { rows: itemRows } = await sql`
      SELECT name, category, SUM(qty) AS qty, SUM(price_total)::float AS ca,
             MIN(date)::text AS min_date, MAX(date)::text AS max_date
      FROM transaction_items
      GROUP BY name, category
      ORDER BY ca DESC
    `

    // Get real totals from transactions table
    const { rows: statsRows } = await sql`
      SELECT COUNT(*) AS nb_tx, COUNT(DISTINCT date) AS nb_days,
             SUM(amount)::float AS real_ca,
             MIN(date)::text AS min_date, MAX(date)::text AS max_date
      FROM transactions
      WHERE status = 'successful'
    `
    const stats = statsRows[0]
    const nbDays = parseInt(stats.nb_days) || 1
    const realCA = stats.real_ca || 0
    const nbTx = parseInt(stats.nb_tx) || 0

    // Check coverage: how many transactions have items?
    const { rows: coverageRows } = await sql`
      SELECT COUNT(DISTINCT transaction_code) AS with_items
      FROM transaction_items
    `
    const txWithItems = parseInt(coverageRows[0].with_items) || 0

    // Build articles array
    const totalArticleCA = itemRows.reduce((s, r) => s + (r.ca || 0), 0)
    const articles = itemRows.map(r => ({
      name: r.name,
      qty: parseInt(r.qty),
      ca: Math.round((r.ca || 0) * 100) / 100,
      prix: parseInt(r.qty) > 0 ? Math.round((r.ca || 0) / parseInt(r.qty) * 100) / 100 : 0,
      cat: r.category || 'Non attribué',
      vel: nbDays > 0 ? Math.round(parseInt(r.qty) / nbDays * 10) / 10 : 0,
    }))

    // Build category aggregation
    const catMap: Record<string, { ca: number; qty: number; refs: Set<string> }> = {}
    for (const a of articles) {
      if (!catMap[a.cat]) catMap[a.cat] = { ca: 0, qty: 0, refs: new Set() }
      catMap[a.cat].ca += a.ca
      catMap[a.cat].qty += a.qty
      catMap[a.cat].refs.add(a.name)
    }

    const categories = Object.entries(catMap)
      .map(([name, data]) => ({
        name,
        ca: Math.round(data.ca),
        qty: data.qty,
        refs: data.refs.size,
        prixMoy: data.qty > 0 ? Math.round(data.ca / data.qty * 100) / 100 : 0,
        pct: totalArticleCA > 0 ? Math.round(data.ca / totalArticleCA * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.ca - a.ca)

    // Pareto data
    let cumul = 0
    const pareto = articles.slice(0, 30).map(a => {
      cumul += a.ca
      return { name: a.name, ca: Math.round(a.ca), cumulPct: totalArticleCA > 0 ? Math.round(cumul / totalArticleCA * 100) : 0 }
    })

    const dateRange = itemRows.length > 0
      ? { from: stats.min_date, to: stats.max_date }
      : { from: '', to: '' }

    return NextResponse.json({
      articles,
      categories,
      pareto,
      meta: {
        dateRange,
        nbDays,
        nbTransactions: nbTx,
        txWithProducts: txWithItems,
        coverage: nbTx > 0 ? Math.round(txWithItems / nbTx * 100) : 0,
        totalCA: Math.round(totalArticleCA),
        realCA: Math.round(realCA),
        totalQty: articles.reduce((s, a) => s + a.qty, 0),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
