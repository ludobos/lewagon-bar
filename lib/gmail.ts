/**
 * Gmail + Google Drive Client
 * Account: bar.lewagon@gmail.com
 *
 * Flow:
 * 1. First auth: /api/gmail/connect → Google OAuth consent
 * 2. Callback saves refresh_token to DB
 * 3. Morning cron reads new mails from known suppliers
 * 4. PDF attachments → Claude extracts data → saved to DB + Drive /Factures/YYYY/MM/
 */

import { google } from 'googleapis'
import { sql } from '@vercel/postgres'
import Anthropic from '@anthropic-ai/sdk'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.file',
]

// Known invoice senders (partial match on from address)
const INVOICE_SENDERS = (process.env.INVOICE_SENDERS || 'abn,promocash,edf,enedis,loyer,bail,bnp')
  .split(',')
  .map(s => s.trim().toLowerCase())

// ─── OAuth ────────────────────────────────────────────────────────────────────

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export function getAuthUrl(): string {
  const client = getOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // force refresh_token delivery
  })
}

export async function handleCallback(code: string) {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  await saveTokens(tokens)
  return tokens
}

async function saveTokens(tokens: any) {
  await sql`
    INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope, updated_at)
    VALUES (
      'google',
      ${tokens.access_token},
      ${tokens.refresh_token || null},
      ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null},
      ${SCOPES.join(' ')},
      NOW()
    )
    ON CONFLICT (provider) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_tokens.refresh_token),
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
  `
}

async function getAuthenticatedClient() {
  const { rows } = await sql`SELECT * FROM oauth_tokens WHERE provider = 'google'`
  const stored = rows[0]
  if (!stored) throw new Error('Gmail non connecté.')

  const client = getOAuthClient()
  client.setCredentials({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
  })

  // Auto-refresh
  client.on('tokens', async (tokens) => {
    await saveTokens({ ...tokens, refresh_token: tokens.refresh_token || stored.refresh_token })
  })

  return client
}

export async function isConnected(): Promise<boolean> {
  const { rows } = await sql`SELECT provider FROM oauth_tokens WHERE provider = 'google'`
  return rows.length > 0
}

// ─── Drive: ensure /Factures/YYYY/MM/ folder exists ──────────────────────────

async function getOrCreateFolder(drive: any, name: string, parentId?: string): Promise<string> {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`

  const res = await drive.files.list({ q, fields: 'files(id)' })
  if (res.data.files.length > 0) return res.data.files[0].id

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId && { parents: [parentId] }),
    },
    fields: 'id',
  })
  return created.data.id
}

async function getInvoiceFolderId(drive: any, year: number, month: number): Promise<string> {
  const root = await getOrCreateFolder(drive, 'Factures')
  const yearFolder = await getOrCreateFolder(drive, String(year), root)
  const monthFolder = await getOrCreateFolder(drive, String(month).padStart(2, '0'), yearFolder)
  return monthFolder
}

// ─── Claude invoice extraction ────────────────────────────────────────────────

async function extractInvoiceData(fileBase64: string, mimeType: string, filename: string) {
  const client = new Anthropic()
  const isPdf = mimeType === 'application/pdf'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        {
          type: isPdf ? 'document' : 'image',
          source: { type: 'base64', media_type: mimeType as any, data: fileBase64 },
        } as any,
        {
          type: 'text',
          text: 'Facture de bar/restaurant français. Réponds UNIQUEMENT en JSON valide sans markdown: {"fournisseur":"nom","date":"YYYY-MM-DD","montant_ht":0.00,"montant_ttc":0.00,"tva":0.00,"categorie":"boissons|food|charges|loyer|materiel|salaires|autres","description":"articles principaux en 1 ligne courte"}',
        },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

// ─── Main sync ────────────────────────────────────────────────────────────────

export async function syncInvoices(): Promise<number> {
  try {
    const auth = await getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })
    const drive = google.drive({ version: 'v3', auth })

    // Build Gmail query: unread mails from known suppliers
    const fromQuery = INVOICE_SENDERS.map(s => `from:${s}`).join(' OR ')
    const query = `(${fromQuery}) has:attachment is:unread`

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 20,
    })

    const messages = listRes.data.messages || []
    let processed = 0

    for (const msg of messages) {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      })

      const parts = full.data.payload?.parts || []
      const attachments = parts.filter(p =>
        p.mimeType === 'application/pdf' ||
        (p.mimeType || '').startsWith('image/')
      )

      for (const att of attachments) {
        if (!att.body?.attachmentId) continue

        // Check not already imported
        const existing = await sql`
          SELECT id FROM invoices WHERE gmail_id = ${msg.id + '_' + att.partId}
        `
        if (existing.rows.length > 0) continue

        // Download attachment
        const attRes = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: msg.id!,
          id: att.body.attachmentId,
        })
        const fileData = attRes.data.data!
        const filename = att.filename || `facture_${Date.now()}.pdf`
        const mimeType = att.mimeType || 'application/pdf'

        // Extract with Claude
        let extracted: any = {}
        let extractionOk = true
        try {
          extracted = await extractInvoiceData(fileData, mimeType, filename)
        } catch {
          extractionOk = false
        }

        // Upload to Drive /Factures/YYYY/MM/
        const now = new Date()
        const folderId = await getInvoiceFolderId(drive, now.getFullYear(), now.getMonth() + 1)
        const uploadRes = await drive.files.create({
          requestBody: { name: filename, parents: [folderId] },
          media: {
            mimeType,
            body: Buffer.from(fileData, 'base64'),
          },
          fields: 'id,webViewLink',
        })
        const driveFileId = uploadRes.data.id!
        const driveUrl = uploadRes.data.webViewLink!

        // Save to DB
        await sql`
          INSERT INTO invoices (
            gmail_id, drive_file_id, drive_url, filename,
            fournisseur, date_facture, montant_ht, montant_ttc,
            tva, categorie, description, extraction_ok
          ) VALUES (
            ${msg.id + '_' + att.partId},
            ${driveFileId},
            ${driveUrl},
            ${filename},
            ${extracted.fournisseur || null},
            ${extracted.date || null},
            ${extracted.montant_ht || null},
            ${extracted.montant_ttc || null},
            ${extracted.tva || null},
            ${extracted.categorie || 'autres'},
            ${extracted.description || null},
            ${extractionOk}
          )
          ON CONFLICT (gmail_id) DO NOTHING
        `

        // Mark mail as read
        await gmail.users.messages.modify({
          userId: 'me',
          id: msg.id!,
          requestBody: { removeLabelIds: ['UNREAD'] },
        })

        processed++
      }
    }

    await sql`
      INSERT INTO sync_log (source, status, message, records)
      VALUES ('gmail', 'ok', 'Factures importées', ${processed})
    `

    return processed
  } catch (err: any) {
    await sql`
      INSERT INTO sync_log (source, status, message, records)
      VALUES ('gmail', 'error', ${err.message}, 0)
    `
    throw err
  }
}
