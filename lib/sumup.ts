/**
 * SumUp API Client
 * Supports both API key (preferred) and OAuth token
 */

import { sql } from '@vercel/postgres'

const SUMUP_API = 'https://api.sumup.com'

// ─── Auth ────────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  // 1. Use API key if available (simplest)
  if (process.env.SUMUP_API_KEY) {
    return process.env.SUMUP_API_KEY
  }

  // 2. Fallback to stored OAuth token
  const { rows } = await sql`
    SELECT access_token, refresh_token, expires_at
    FROM oauth_tokens WHERE provider = 'sumup'
  `
  const tokens = rows[0]
  if (!tokens) throw new Error('SumUp non connecté et pas de clé API.')

  // Refresh if needed
  if (tokens.expires_at && new Date(tokens.expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
    const res = await fetch(`${SUMUP_API}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.SUMUP_CLIENT_ID!,
        client_secret: process.env.SUMUP_CLIENT_SECRET!,
        refresh_token: tokens.refresh_token,
      }),
    })
    const data = await res.json()
    if (!data.access_token) throw new Error('SumUp refresh failed')
    await sql`
      UPDATE oauth_tokens SET access_token = ${data.access_token},
        refresh_token = ${data.refresh_token || tokens.refresh_token},
        expires_at = ${new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()},
        updated_at = NOW()
      WHERE provider = 'sumup'
    `
    return data.access_token
  }

  return tokens.access_token
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function get(path: string) {
  const token = await getToken()
  const res = await fetch(`${SUMUP_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`SumUp ${res.status}: ${await res.text()}`)
  return res.json()
}

// ─── OAuth (keep for backward compat) ────────────────────────────────────────

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SUMUP_CLIENT_ID || '',
    redirect_uri: process.env.SUMUP_REDIRECT_URI || '',
    scope: 'payments:history',
  })
  return `https://api.sumup.com/authorize?${params}`
}

export async function handleCallback(code: string) {
  const res = await fetch(`${SUMUP_API}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.SUMUP_CLIENT_ID!,
      client_secret: process.env.SUMUP_CLIENT_SECRET!,
      redirect_uri: process.env.SUMUP_REDIRECT_URI!,
      code,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('SumUp auth failed')
  await sql`
    INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, updated_at)
    VALUES ('sumup', ${data.access_token}, ${data.refresh_token}, ${new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()}, NOW())
    ON CONFLICT (provider) DO UPDATE SET
      access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at, updated_at = NOW()
  `
  return data
}

export async function isConnected(): Promise<boolean> {
  if (process.env.SUMUP_API_KEY) return true
  try {
    const { rows } = await sql`SELECT access_token FROM oauth_tokens WHERE provider = 'sumup'`
    return !!rows[0]?.access_token
  } catch { return false }
}

// ─── Merchant code (cached) ──────────────────────────────────────────────────

let _merchantCode = ''
async function getMerchantCode(): Promise<string> {
  if (_merchantCode) return _merchantCode
  const me = await get('/v0.1/me')
  _merchantCode = me.merchant_profile?.merchant_code || ''
  return _merchantCode
}

// ─── Fetch receipt products ──────────────────────────────────────────────────

async function fetchReceiptProducts(txCode: string): Promise<any[]> {
  try {
    const mc = await getMerchantCode()
    const token = await getToken()
    const res = await fetch(`${SUMUP_API}/v1.0/receipts/${txCode}?mid=${mc}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.transaction_data?.products || []
  } catch {
    return []
  }
}

// ─── Article category mapping ────────────────────────────────────────────────

const ARTICLE_CATEGORIES: Record<string, string> = {
  'Expresso': 'Boissons chaudes', 'Café allongé': 'Boissons chaudes', 'Cafe Emporte': 'Boissons chaudes',
  'Café noisette': 'Boissons chaudes', 'Cappuccino': 'Boissons chaudes', 'Grand café': 'Boissons chaudes',
  'Grand crème': 'Boissons chaudes', 'Petit crème': 'Boissons chaudes', 'Déca': 'Boissons chaudes',
  'Déca allongé': 'Boissons chaudes', 'Déca grand': 'Boissons chaudes', 'Déca grand crème': 'Boissons chaudes',
  'Déca petit crème': 'Boissons chaudes', 'Chocolat petit': 'Boissons chaudes', 'Chocolat grand': 'Boissons chaudes',
  'Thé nature': 'Boissons chaudes', 'Thé parfumé': 'Boissons chaudes', 'Viennois': 'Boissons chaudes',
  'Vin chaud - grog': 'Boissons chaudes', 'Lait sirop': 'Boissons chaudes',
  'Veltins demi': 'Bières pressions', 'Veltins pinte': 'Bières pressions',
  'Nantaise IPA demi': 'Bières pressions', 'Nantaise IPA pinte': 'Bières pressions',
  'Nantaise ambrée demi': 'Bières pressions', 'Nantaise ambrée pinte': 'Bières pressions',
  'Picon bière demi': 'Bières pressions', 'Picon bière pinte': 'Bières pressions',
  'Monaco demi': 'Bières pressions', 'Monaco pinte': 'Bières pressions',
  'Bière sans alcool': 'Bières pressions', 'Despe': 'Bières pressions',
  'Galo Vetlins': 'Bières pressions', 'Galopin Nantaise': 'Bières pressions',
  'Panache': 'Bières pressions',
  'Muscadet': 'Vins', 'Bouteille Muscadet': 'Vins', 'Côte du Rhône': 'Vins',
  'Chenin': 'Vins', 'Btl Chenin': 'Vins', 'Colombelle': 'Vins',
  'Sauvignon': 'Vins', 'Rosé corse': 'Vins', 'Côte Marmandais': 'Vins',
  'Coca-cola': 'Sodas', 'Coca zéro': 'Sodas', 'Coca cherry': 'Sodas',
  'Orangina': 'Sodas', 'Perrier': 'Sodas', 'Fuze tea': 'Sodas',
  'Jus de fruit': 'Sodas', 'Jus tomates': 'Sodas', 'Limonade': 'Sodas',
  'Diabolo': 'Sodas', 'Diabolos': 'Sodas', 'Sirop à l\'eau': 'Sodas',
  'Orange pressée': 'Sodas', 'Citron pressé': 'Sodas', 'Schweppes': 'Sodas',
  'Ginger Beer': 'Sodas', 'Vittel': 'Sodas', 'Vittel sirop': 'Sodas',
  'Sirop enfant': 'Sodas', 'Sup Tranche/Sirop': 'Sodas',
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

// ─── Sync ────────────────────────────────────────────────────────────────────

export async function syncTransactions(daysBack = 2): Promise<number> {
  const start = new Date()
  start.setDate(start.getDate() - daysBack)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = new Date().toISOString().slice(0, 10)

  try {
    const params = new URLSearchParams({
      oldest_time: `${startDate}T00:00:00.000Z`,
      newest_time: `${endDate}T23:59:59.999Z`,
      limit: '100',
    })

    let inserted = 0
    let itemsSynced = 0
    let hasMore = true
    let url = `/v0.1/me/transactions/history?${params}`

    while (hasMore) {
      const data = await get(url)
      const items: any[] = data.items || []

      for (const tx of items) {
        if (tx.status !== 'SUCCESSFUL') continue
        const txDate = (tx.timestamp || endDate).slice(0, 10)
        const txId = tx.id || tx.transaction_code
        const txCode = tx.transaction_code || ''

        // Skip if this transaction_code already exists under a different sumup_id
        if (txCode) {
          const { rows: existing } = await sql`
            SELECT sumup_id FROM transactions
            WHERE sumup_id = ${txCode}
               OR raw_data->>'transaction_code' = ${txCode}
            LIMIT 1
          `
          if (existing.length > 0 && existing[0].sumup_id !== txId) continue
        }

        const { rowCount } = await sql`
          INSERT INTO transactions (sumup_id, date, amount, tip, payment_type, status, raw_data)
          VALUES (
            ${txId},
            ${txDate},
            ${parseFloat(tx.amount || 0)},
            ${parseFloat(tx.tip_amount || 0)},
            ${(tx.payment_type || '').toLowerCase()},
            'successful',
            ${JSON.stringify(tx)}
          )
          ON CONFLICT (sumup_id) DO NOTHING
        `
        if (rowCount) inserted++

        // Fetch receipt products for this transaction (100% coverage)
        if (txCode) {
          const { rows: existingItems } = await sql`
            SELECT 1 FROM transaction_items WHERE transaction_code = ${txCode} LIMIT 1
          `
          if (existingItems.length === 0) {
            const products = await fetchReceiptProducts(txCode)
            for (const p of products) {
              if (!p.name) continue
              await sql`
                INSERT INTO transaction_items (transaction_code, date, name, category, qty, price_unit, price_total, vat_rate)
                VALUES (
                  ${txCode}, ${txDate}, ${p.name},
                  ${ARTICLE_CATEGORIES[p.name] || 'Non attribué'},
                  ${p.quantity || 1},
                  ${parseFloat(p.price_with_vat || p.price || 0)},
                  ${parseFloat(p.total_with_vat || p.total_price || 0)},
                  ${parseFloat(p.vat_rate || 0)}
                )
              `
              itemsSynced++
            }
          }
        }
      }

      // Check for next page
      if (data.links && data.links.length > 0) {
        const next = data.links.find((l: any) => l.rel === 'next')
        if (next?.href) {
          const href = next.href as string
          if (href.startsWith('http')) {
            const u = new URL(href)
            url = u.pathname + u.search
          } else if (href.startsWith('/')) {
            url = href
          } else {
            url = `/v0.1/me/transactions/history?${href}`
          }
        } else {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    }

    await sql`
      INSERT INTO sync_log (source, status, message, records)
      VALUES ('sumup', 'ok', ${`Synced ${startDate} → ${endDate}: ${inserted} tx, ${itemsSynced} items`}, ${inserted})
    `

    return inserted
  } catch (err: any) {
    await sql`
      INSERT INTO sync_log (source, status, message, records)
      VALUES ('sumup', 'error', ${err.message}, 0)
    `
    throw err
  }
}
