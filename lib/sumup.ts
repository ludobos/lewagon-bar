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

// ─── Sync ────────────────────────────────────────────────────────────────────

export async function syncTransactions(daysBack = 1): Promise<number> {
  const start = new Date()
  start.setDate(start.getDate() - daysBack)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = new Date().toISOString().slice(0, 10)

  try {
    // SumUp paginates with oldest_time / newest_time
    const params = new URLSearchParams({
      oldest_time: `${startDate}T00:00:00.000Z`,
      newest_time: `${endDate}T23:59:59.999Z`,
      limit: '100',
    })

    let inserted = 0
    let hasMore = true
    let url = `/v0.1/me/transactions/history?${params}`

    while (hasMore) {
      const data = await get(url)
      const items: any[] = data.items || []

      for (const tx of items) {
        if (tx.status !== 'SUCCESSFUL') continue
        const txDate = (tx.timestamp || endDate).slice(0, 10)
        const { rowCount } = await sql`
          INSERT INTO transactions (sumup_id, date, amount, tip, payment_type, status, raw_data)
          VALUES (
            ${tx.id || tx.transaction_code},
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
      }

      // Check for next page
      if (data.links && data.links.length > 0) {
        const next = data.links.find((l: any) => l.rel === 'next')
        if (next?.href) {
          url = next.href.replace(SUMUP_API, '')
        } else {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    }

    await sql`
      INSERT INTO sync_log (source, status, message, records)
      VALUES ('sumup', 'ok', ${`Synced ${startDate} → ${endDate}: ${inserted} new`}, ${inserted})
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
