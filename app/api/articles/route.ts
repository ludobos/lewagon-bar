import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

// Parse "2 x Expresso" or "Grand café" from product_summary
function parseProductSummary(summary: string): { name: string; qty: number }[] {
  if (!summary) return []
  // Can be multi-line or comma-separated
  const parts = summary.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
  return parts.map(part => {
    const match = part.match(/^(\d+)\s*x\s+(.+)$/i)
    if (match) {
      return { name: match[2].trim(), qty: parseInt(match[1]) }
    }
    // Single item
    return { name: part.trim(), qty: 1 }
  })
}

// Article category mapping
const CATEGORIES: Record<string, string> = {
  'Expresso': 'Boissons chaudes', 'Café allongé': 'Boissons chaudes', 'Cafe Emporte': 'Boissons chaudes',
  'Café noisette': 'Boissons chaudes', 'Cappuccino': 'Boissons chaudes', 'Grand café': 'Boissons chaudes',
  'Grand crème': 'Boissons chaudes', 'Petit crème': 'Boissons chaudes', 'Déca': 'Boissons chaudes',
  'Déca allongé': 'Boissons chaudes', 'Déca grand': 'Boissons chaudes', 'Déca grand crème': 'Boissons chaudes',
  'Déca petit crème': 'Boissons chaudes', 'Chocolat petit': 'Boissons chaudes', 'Chocolat grand': 'Boissons chaudes',
  'Thé nature': 'Boissons chaudes', 'Thé parfumé': 'Boissons chaudes', 'Viennois': 'Boissons chaudes',
  'Vin chaud - grog': 'Boissons chaudes',

  'Veltins demi': 'Bières pressions', 'Veltins pinte': 'Bières pressions',
  'Nantaise IPA demi': 'Bières pressions', 'Nantaise IPA pinte': 'Bières pressions',
  'Nantaise ambrée demi': 'Bières pressions', 'Nantaise ambrée pinte': 'Bières pressions',
  'Picon bière demi': 'Bières pressions', 'Picon bière pinte': 'Bières pressions',
  'Monaco demi': 'Bières pressions', 'Monaco pinte': 'Bières pressions',
  'Bière sans alcool': 'Bières pressions', 'Despe': 'Bières pressions',
  'Galo Vetlins': 'Bières pressions', 'Galopin Nantaise': 'Bières pressions',

  'Muscadet': 'Vins', 'Bouteille Muscadet': 'Vins', 'Côte du Rhône': 'Vins',
  'Chenin': 'Vins', 'Btl Chenin': 'Vins', 'Colombelle': 'Vins',
  'Sauvignon': 'Vins', 'Rosé corse': 'Vins', 'Côte Marmandais': 'Vins',

  'Coca-cola': 'Sodas', 'Coca zéro': 'Sodas', 'Coca cherry': 'Sodas',
  'Orangina': 'Sodas', 'Perrier': 'Sodas', 'Fuze tea': 'Sodas',
  'Jus de fruit': 'Sodas', 'Jus tomates': 'Sodas', 'Limonade': 'Sodas',
  'Diabolo': 'Sodas', 'Diabolos': 'Sodas', 'Sirop à l\'eau': 'Sodas',
  'Orange pressée': 'Sodas', 'Citron pressé': 'Sodas', 'Schweppes': 'Sodas',
  'Ginger Beer': 'Sodas', 'Vittel': 'Sodas', 'Vittel sirop': 'Sodas',

  'Croque monsieur': 'Snack', 'Croque madame': 'Snack', 'Planche Mixte': 'Snack',
  'Petite Mixte': 'Snack', 'Assiette Charcuterie': 'Snack', 'Assiette Fromage': 'Snack',
  'Jambon Beurre': 'Snack', 'Sandwich': 'Snack', 'Sandwich Jambon / Fromage / Cornichons': 'Snack',
  'Sandwich Jambon fromage': 'Snack',

  'Ricard': 'Apéritifs', 'Kir': 'Apéritifs', 'Martini': 'Apéritifs',

  'Mojito': 'Cocktails', 'Spritz': 'Cocktails', 'Mule': 'Cocktails',
  'Planteur': 'Cocktails', 'Ti punch': 'Cocktails',

  'Whisky': 'Digestifs', 'Cognac': 'Digestifs', 'Cognac aux amandes': 'Digestifs',
  'Armagnac': 'Digestifs', 'Calva': 'Digestifs', 'Menthe pastille': 'Digestifs',
  'Shooter Menthe Pastille': 'Digestifs', 'Shooter Botran 4cl': 'Digestifs',
}

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    // Get all SumUp transactions with raw_data
    const { rows } = await sql`
      SELECT raw_data, amount::float, date::text
      FROM transactions
      WHERE status = 'successful' AND sumup_id IS NOT NULL
      ORDER BY date ASC
    `

    const dateRange = rows.length > 0
      ? { from: rows[0].date, to: rows[rows.length - 1].date }
      : { from: '', to: '' }

    // Count days
    const uniqueDays = new Set(rows.map(r => r.date))
    const nbDays = uniqueDays.size

    // Parse product_summary from raw_data
    const articleMap: Record<string, { qty: number; ca: number }> = {}
    let txWithProducts = 0
    let txTotal = rows.length

    for (const row of rows) {
      const raw = row.raw_data as any
      const summary = raw?.product_summary
      if (!summary) continue
      txWithProducts++

      const items = parseProductSummary(summary)
      // Distribute the transaction amount proportionally if multiple items
      const totalItems = items.reduce((s, i) => s + i.qty, 0)

      for (const item of items) {
        if (!articleMap[item.name]) articleMap[item.name] = { qty: 0, ca: 0 }
        articleMap[item.name].qty += item.qty
        // Approximate CA per item
        articleMap[item.name].ca += (item.qty / totalItems) * row.amount
      }
    }

    // Build articles array sorted by CA
    const articles = Object.entries(articleMap)
      .map(([name, data]) => ({
        name,
        qty: data.qty,
        ca: Math.round(data.ca * 100) / 100,
        prix: data.qty > 0 ? Math.round(data.ca / data.qty * 100) / 100 : 0,
        cat: CATEGORIES[name] || 'Non attribué',
        vel: nbDays > 0 ? Math.round(data.qty / nbDays * 10) / 10 : 0,
      }))
      .sort((a, b) => b.ca - a.ca)

    // Build category aggregation
    const catMap: Record<string, { ca: number; qty: number; refs: Set<string> }> = {}
    for (const a of articles) {
      if (!catMap[a.cat]) catMap[a.cat] = { ca: 0, qty: 0, refs: new Set() }
      catMap[a.cat].ca += a.ca
      catMap[a.cat].qty += a.qty
      catMap[a.cat].refs.add(a.name)
    }

    const totalCA = articles.reduce((s, a) => s + a.ca, 0)
    const categories = Object.entries(catMap)
      .map(([name, data]) => ({
        name,
        ca: Math.round(data.ca),
        qty: data.qty,
        refs: data.refs.size,
        prixMoy: data.qty > 0 ? Math.round(data.ca / data.qty * 100) / 100 : 0,
        pct: totalCA > 0 ? Math.round(data.ca / totalCA * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.ca - a.ca)

    // Pareto data
    let cumul = 0
    const pareto = articles.slice(0, 30).map(a => {
      cumul += a.ca
      return { name: a.name, ca: Math.round(a.ca), cumulPct: totalCA > 0 ? Math.round(cumul / totalCA * 100) : 0 }
    })

    // Real total CA from ALL transactions (not just ones with product_summary)
    const realCA = rows.reduce((s, r) => s + r.amount, 0)

    return NextResponse.json({
      articles,
      categories,
      pareto,
      meta: {
        dateRange,
        nbDays,
        nbTransactions: txTotal,
        txWithProducts,
        coverage: txTotal > 0 ? Math.round(txWithProducts / txTotal * 100) : 0,
        totalCA: Math.round(totalCA),
        realCA: Math.round(realCA),
        totalQty: articles.reduce((s, a) => s + a.qty, 0),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
