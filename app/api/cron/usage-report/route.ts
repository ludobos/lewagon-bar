import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { Resend } from 'resend'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  // Yesterday's usage
  const { rows: pages } = await sql`
    SELECT page, COUNT(*) as views
    FROM page_views
    WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
      AND created_at < CURRENT_DATE
      AND page NOT LIKE 'chat:%'
    GROUP BY page
    ORDER BY views DESC
  `

  const { rows: chats } = await sql`
    SELECT REPLACE(page, 'chat:', '') as message, created_at::text as heure
    FROM page_views
    WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
      AND created_at < CURRENT_DATE
      AND page LIKE 'chat:%'
    ORDER BY created_at ASC
  `

  const { rows: totals } = await sql`
    SELECT
      COUNT(*) FILTER (WHERE page NOT LIKE 'chat:%') as page_views,
      COUNT(*) FILTER (WHERE page LIKE 'chat:%') as chat_messages,
      MIN(created_at)::text as premiere_visite,
      MAX(created_at)::text as derniere_visite
    FROM page_views
    WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
      AND created_at < CURRENT_DATE
  `

  const t = totals[0] || { page_views: 0, chat_messages: 0, premiere_visite: '-', derniere_visite: '-' }
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const noActivity = Number(t.page_views) === 0 && Number(t.chat_messages) === 0

  // Build email
  const pagesHtml = pages.length > 0
    ? pages.map(p => `<tr><td style="padding:4px 12px;border-bottom:1px solid #eee">${p.page}</td><td style="padding:4px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${p.views}</td></tr>`).join('')
    : '<tr><td colspan="2" style="padding:8px;color:#999">Aucune visite</td></tr>'

  const chatsHtml = chats.length > 0
    ? chats.map(c => {
        const h = new Date(c.heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        return `<div style="padding:6px 0;border-bottom:1px solid #f0f0f0"><span style="color:#999;font-size:12px">${h}</span> — ${c.message}</div>`
      }).join('')
    : '<p style="color:#999">Aucun message</p>'

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#b45309">🚂 Le Wagon — Rapport d'utilisation</h2>
      <p style="color:#666">${dateStr}</p>

      ${noActivity ? '<div style="background:#fef3c7;padding:16px;border-radius:8px;margin:16px 0"><strong>⚠️ Aucune activité hier.</strong><br>François n\'a pas ouvert l\'app.</div>' : `
      <div style="background:#f9fafb;padding:12px;border-radius:8px;margin:16px 0">
        <strong>${t.page_views} pages vues</strong> · <strong>${t.chat_messages} messages chat</strong><br>
        <span style="color:#666;font-size:13px">Première visite : ${new Date(t.premiere_visite).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · Dernière : ${new Date(t.derniere_visite).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <h3 style="color:#374151;margin-top:24px">📱 Pages visitées</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="background:#f3f4f6"><th style="padding:4px 12px;text-align:left">Page</th><th style="padding:4px 12px;text-align:right">Vues</th></tr>
        ${pagesHtml}
      </table>

      <h3 style="color:#374151;margin-top:24px">💬 Messages assistant</h3>
      <div style="font-size:14px">${chatsHtml}</div>
      `}

      <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
        Rapport automatique — Le Wagon App
      </p>
    </div>
  `

  try {
    await resend.emails.send({
      from: 'Le Wagon App <onboarding@resend.dev>',
      to: 'lbostral@gmail.com',
      subject: noActivity
        ? `🚂 Le Wagon — Aucune activité le ${dateStr}`
        : `🚂 Le Wagon — ${t.page_views} pages, ${t.chat_messages} messages (${dateStr})`,
      html,
    })

    return NextResponse.json({ ok: true, pages: pages.length, chats: chats.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
