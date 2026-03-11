import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { sql } from '@vercel/postgres'

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Clé API Anthropic non configurée. Demande à Ludovic.' }, { status: 500 })

  const { messages } = await req.json()

  // Load context from DB
  let stats: any = {}
  let recentDays: any[] = []
  let expenses: any[] = []
  let events: any[] = []
  let targetValue = 500

  try {
    const [statsRes, daysRes, eventsRes, settingsRes] = await Promise.all([
      sql`
        SELECT COUNT(*) AS nb_jours, COALESCE(SUM(amount),0)::float AS ca_total,
               COALESCE(AVG(amount),0)::float AS ca_moyen, COALESCE(MAX(amount),0)::float AS ca_max
        FROM (SELECT date, SUM(amount) AS amount FROM transactions WHERE status='successful' GROUP BY date) t
      `.catch(() => ({ rows: [{}] })),
      sql`
        SELECT date::text, SUM(amount)::float AS ca
        FROM transactions WHERE status='successful' AND date >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY date ORDER BY date ASC
      `.catch(() => ({ rows: [] })),
      sql`SELECT date, type, description, impact FROM events ORDER BY date DESC LIMIT 10`.catch(() => ({ rows: [] })),
      sql`SELECT value FROM settings WHERE key = 'daily_target'`.catch(() => ({ rows: [] })),
    ])
    stats = statsRes.rows[0]
    recentDays = daysRes.rows
    events = eventsRes.rows
    targetValue = parseInt(settingsRes.rows[0]?.value || '500')

    // Expenses from invoices (may not exist yet)
    try {
      const expRes = await sql`
        SELECT categorie, SUM(montant_ttc)::float AS total_ttc
        FROM invoices
        WHERE date_facture >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY categorie
        LIMIT 6
      `
      expenses = expRes.rows
    } catch {}
  } catch {
    // DB might not have all tables yet, continue with empty data
  }

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const systemPrompt = `Tu es l'assistant de gestion du bar "Le Wagon — Bar à Papote et à Grignote", 22 quai de la Fosse, Nantes.

DATE DU JOUR: ${today}. Utilise TOUJOURS cette date comme référence. "Semaine prochaine" = la semaine qui suit cette date.

ACTEURS:
- François Rocu: gérant, 20 ans barman, néo-entrepreneur, dysorthographique. Réponds simplement, pas de jargon.
- Ludovic Bostral: investisseur 25%, conseiller tech

FINANCES:
- Emprunt BNP: 51 000€ sur 83 mois à 4.42% = 730€/mois
- Objectif journalier: ${targetValue}€/jour
- Ouverture: mardi au samedi (5j/sem)

DONNÉES VENTES (${stats?.nb_jours || 0} jours enregistrés):
- CA total: ${stats?.ca_total?.toFixed(0) || 0}€
- Moyenne/jour: ${stats?.ca_moyen?.toFixed(0) || 0}€
- Record: ${stats?.ca_max?.toFixed(0) || 0}€
- CA mensuel projeté (×20j): ${((stats?.ca_moyen || 0) * 20).toFixed(0)}€

14 DERNIERS JOURS:
${recentDays.map(d => `${d.date}: ${d.ca?.toFixed(0)}€`).join('\n') || 'Pas encore de données'}

DÉPENSES PAR CATÉGORIE (ce mois):
${expenses.length > 0 ? expenses.map((e: any) => `${e.categorie}: ${e.total_ttc?.toFixed(0)}€`).join('\n') : 'Aucune facture saisie'}

ÉVÉNEMENTS RÉCENTS:
${events.map((e: any) => `${e.date}: [${e.type}] ${e.description} (${e.impact})`).join('\n') || 'Aucun'}

CONTEXTE BAR:
- Top produits: Expresso (36% CA), bières pression, Muscadet, café allongé
- Ticket moyen ~7.26€ (objectif 10€)
- Pic de CA: 13h (34% du CA, pause déjeuner bureaux du quai)
- Samedi = 2x le mardi
- Météo soleil = terrasse = +sodas +cocktails. Pluie = +cafés +chocolats

Réponds en français, de façon concise et encourageante. Utilise des chiffres. Langage simple, pas de jargon financier. Sois positif — François fait un super boulot pour un néo-entrepreneur.

FORMATAGE: N'utilise PAS de markdown (pas de gras, pas de titres, pas de blocs de code). Écris en texte brut uniquement. Utilise des tirets (-) pour les listes et des retours à la ligne pour séparer les idées.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: systemPrompt,
        messages,
      }),
    })

    const data = await res.json()

    if (data.error) {
      return NextResponse.json({ error: `Erreur API: ${data.error.message}` }, { status: 500 })
    }

    const content = data.content?.[0]?.text || ''
    return NextResponse.json({ content })
  } catch (err: any) {
    return NextResponse.json({ error: `Erreur: ${err.message || 'Connexion impossible'}` }, { status: 500 })
  }
}
