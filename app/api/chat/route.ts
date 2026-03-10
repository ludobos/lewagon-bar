import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { getRevenueStats, getDailyRevenue } from '@/lib/db/transactions'
import { getMonthlyExpenses } from '@/lib/db/invoices'
import { sql } from '@vercel/postgres'

const client = new Anthropic()

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { messages } = await req.json()

  // Load context from DB
  const [stats, recentDays, expenses, events] = await Promise.all([
    getRevenueStats(),
    getDailyRevenue(14),
    getMonthlyExpenses(),
    sql`SELECT date, type, description, impact FROM events ORDER BY date DESC LIMIT 10`.then(r => r.rows),
  ])

  const systemPrompt = `Tu es l'assistant de gestion du bar "Le Wagon — Bar à Papote et à Grignote", 22 quai de la Fosse, Nantes.

ACTEURS:
- François Rocu: gérant, 20 ans barman, néo-entrepreneur, dysorthographique. Réponds simplement.
- Ludovic Bostral: investisseur 25%, conseiller tech

FINANCES:
- Emprunt BNP: 51 000€ sur 83 mois à 4.42% = 730€/mois
- Objectif journalier: 1 750€/jour
- Ouverture: mardi au samedi

DONNÉES VENTES (${stats?.nb_jours || 0} jours enregistrés):
- CA total: ${stats?.ca_total?.toFixed(0) || 0}€
- Moyenne/jour: ${stats?.ca_moyen?.toFixed(0) || 0}€
- Record: ${stats?.ca_max?.toFixed(0) || 0}€
- Jours objectif atteint: ${stats?.jours_objectif || 0}/${stats?.nb_jours || 0}
- CA mensuel projeté (×20j): ${((stats?.ca_moyen || 0) * 20).toFixed(0)}€

14 DERNIERS JOURS:
${recentDays.map(d => `${d.date}: ${d.ca?.toFixed(0)}€`).join('\n')}

DÉPENSES PAR CATÉGORIE (ce mois):
${expenses.slice(0, 6).map((e: any) => `${e.categorie}: ${e.total_ttc?.toFixed(0)}€`).join('\n')}

ÉVÉNEMENTS RÉCENTS:
${events.map((e: any) => `${e.date}: [${e.type}] ${e.description} (${e.impact})`).join('\n') || 'Aucun'}

Réponds en français, de façon concise et concrète. Utilise des chiffres. Langage simple.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: systemPrompt,
    messages,
  })

  return NextResponse.json({ content: response.content[0].type === 'text' ? response.content[0].text : '' })
}
