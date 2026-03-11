import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(req: Request) {
  try {
    const { page } = await req.json()
    if (!page) return NextResponse.json({ ok: false }, { status: 400 })

    const ua = req.headers.get('user-agent') || ''
    await sql`INSERT INTO page_views (page, user_agent) VALUES (${page}, ${ua})`

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
