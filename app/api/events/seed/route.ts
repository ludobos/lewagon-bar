import { NextResponse } from 'next/server'

// Deprecated: remplacé par /api/cron/sync-context
// Conservé pour éviter les erreurs 404 si des anciens clients appellent encore cette route
export async function POST() {
  return NextResponse.json({ added: 0, total: 0, message: 'Seed désactivé — utiliser /api/cron/sync-context' })
}
