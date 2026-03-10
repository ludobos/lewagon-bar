/**
 * SumUp API Client
 * Docs: https://developer.sumup.com/api
 *
 * OAuth flow:
 * 1. User visits /api/sumup/connect → redirected to SumUp login
 * 2. SumUp redirects to /api/sumup/callback with ?code=...
 * 3. Callback exchanges code for tokens, saved to DB
 * 4. Nightly cron calls syncTransactions()
 */

import { sql } from '@vercel/postgres'

const SUMUP_API = 'https://api.sumup.com'

// ─── Token management ─────────────────────────────────────────────────────────

async function getStoredTokens() {
  const { rows } = await sql`
    SELECT access_token, refresh_token, expires_at
    FROM oauth_tokens WHERE provider = 'sumup'
  `
  return rows[0] || null
}

async function saveTokens(tokens: {
  access_token: string
  refresh_token: string
  expires_in?: number
}) {
  const expires_at = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  await sql`
    INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, updated_at)
    VALUES ('sumup', ${tokens.access_token}, ${tokens.refresh_token}, ${expires_at}, NOW())
    ON CONFLICT (provider) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
  `
}

async function refreshToken(refresh_token: string): Promise<string> {
  const res = await fetch(`${SUMUP_API}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.SUMUP_CLIENT_ID!,
      client_secret: process.env.SUMUP_CLIENT_SECRET!,
      refresh_token,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('SumUp refresh failed: ' + JSON.stringify(data))
  await saveTokens(data)
  return data.access_token
}

async function getValidToken(): Promise<string> {
  const tokens = await getStoredTokens()
  if (!tokens) throw new Error('SumUp non connecté. Aller sur /admin/dashboard et cliquer "Connecter SumUp".')

  // Refresh if expires in < 5 min
  if (tokens.expires_at) {
    const expiresAt = new Date(tokens.expires_at)
    if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      return await refreshToken(tokens.refresh_token)
    }
  }

  return tokens.access_token
}

// ─── OAuth URL ────────────────────────────────────────────────────────────────

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SUMUP_CLIENT_ID!,
    redirect_uri: process.env.SUMUP_REDIRECT_URI!,
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
  if (!data.access_token) throw new Error('SumUp auth failed: ' + JSON.stringify(data))
  await saveTokens(data)
  return data
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function get(path: string) {
  const token = await getValidToken()
  const res = await fetch(`${SUMUP_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`SumUp ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function getMerchant() {
  return get('/v0.1/me')
}

export async function getTransactions(startDate: string, endDate: string) {
  const q = new URLSearchParams({ limit: '100', start_date: startDate, end_date: endDate })
  return get(`/v0.1/me/transactions/history?${q}`)
}

export async function isConnected(): Promise<boolean> {
  const tokens = await getStoredTokens()
  return !!tokens?.access_token
}

// ─── Nightly sync ─────────────────────────────────────────────────────────────

export async function syncTransactions(daysBack = 1): Promise<number> {
  const start = new Date()
  start.setDate(start.getDate() - daysBack)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = new Date().toISOString().slice(0, 10)

  try {
    const data = await getTransactions(startDate, endDate)
    const items: any[] = data.items || []
    let inserted = 0

    for (const tx of items) {
      if (tx.status !== 'SUCCESSFUL') continue
      const { rowCount } = await sql`
        INSERT INTO transactions (sumup_id, date, amount, tip, payment_type, status, raw_data)
        VALUES (
          ${tx.id},
          ${(tx.timestamp || endDate).slice(0, 10)},
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

    await sql`
      INSERT INTO sync_log (source, status, message, records)
      VALUES ('sumup', 'ok', ${`Synced ${startDate} → ${endDate}`}, ${inserted})
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
