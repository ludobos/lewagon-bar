import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

async function getStats() {
  const { rows } = await sql`
    SELECT
      COUNT(*) AS nb_jours,
      COALESCE(SUM(amount), 0)::float AS ca_total,
      COALESCE(AVG(amount), 0)::float AS ca_moyen,
      COALESCE(MAX(amount), 0)::float AS ca_max,
      COUNT(CASE WHEN amount >= 1750 THEN 1 END)::int AS jours_objectif
    FROM (
      SELECT date, SUM(amount) AS amount
      FROM transactions
      WHERE status = 'successful'
      GROUP BY date
    ) t
  `
  return rows[0]
}

async function getLast21Days() {
  const { rows } = await sql`
    SELECT date::text, SUM(amount)::float AS ca, COUNT(*)::int AS nb
    FROM transactions
    WHERE status = 'successful'
      AND date >= CURRENT_DATE - INTERVAL '21 days'
    GROUP BY date
    ORDER BY date ASC
  `
  return rows
}

async function getRecentEvents() {
  const { rows } = await sql`
    SELECT date::text, type, description, impact
    FROM events
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY date ASC
    LIMIT 6
  `
  return rows
}

function formatEur(n: number) {
  return Math.round(n).toLocaleString('fr-FR') + ' €'
}

export default async function DashboardPage() {
  const [stats, days, events] = await Promise.all([getStats(), getLast21Days(), getRecentEvents()])

  const caMoyen = stats.ca_moyen || 0
  const objectif = 1750
  const ratio = caMoyen / objectif
  const caProjeteMois = caMoyen * 20
  const emprunt = 730
  const nbJours = parseInt(stats.nb_jours) || 0
  const joursObj = parseInt(stats.jours_objectif) || 0
  const maxCa = Math.max(...days.map((d: any) => d.ca), objectif)

  return (
    <div className="space-y-5">
      <h1 className="playfair text-xl font-bold text-amber-400">Tableau de bord</h1>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <div className="text-stone-500 text-xs mb-2">Moyenne / jour</div>
          <div className={`stat-value ${ratio >= 1 ? 'text-emerald-400' : caMoyen > 0 ? 'text-amber-400' : 'text-stone-400'}`}>
            {caMoyen > 0 ? formatEur(caMoyen) : '--'}
          </div>
          <div className="text-stone-600 text-xs mt-1">vs objectif {formatEur(objectif)}</div>
        </div>

        <div className="card text-center">
          <div className="text-stone-500 text-xs mb-2">Objectif atteint</div>
          <div className={`stat-value ${joursObj > nbJours / 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {nbJours > 0 ? `${joursObj}/${nbJours}` : '--'}
          </div>
          <div className="text-stone-600 text-xs mt-1">
            {nbJours > 0 ? `${Math.round((joursObj / nbJours) * 100)}% du temps` : 'Pas de données'}
          </div>
        </div>

        <div className="card text-center">
          <div className="text-stone-500 text-xs mb-2">Record journalier</div>
          <div className="stat-value text-emerald-400">
            {stats.ca_max > 0 ? formatEur(stats.ca_max) : '--'}
          </div>
          <div className="text-stone-600 text-xs mt-1">Meilleur jour</div>
        </div>

        <div className="card text-center">
          <div className="text-stone-500 text-xs mb-2">CA mensuel projeté</div>
          <div className="stat-value text-stone-100">
            {caMoyen > 0 ? formatEur(caProjeteMois) : '--'}
          </div>
          <div className="text-stone-600 text-xs mt-1">20 jours ouvrés/mois</div>
        </div>
      </div>

      {/* 21 derniers jours */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-stone-400">CA journalier</h2>
          <div className="flex items-center gap-3 text-xs text-stone-500">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block rounded"></span>CA</span>
            <span className="flex items-center gap-1"><span className="w-3 h-px bg-stone-600 inline-block"></span>Obj.</span>
          </div>
        </div>
        {days.length === 0 ? (
          <div className="card text-center text-stone-500 py-8">
            Aucune vente enregistrée
          </div>
        ) : (
          <div className="space-y-1.5">
            {days.map((d: any) => {
              const pct = Math.max(5, (d.ca / maxCa) * 100)
              const aboveTarget = d.ca >= objectif
              const dateStr = new Date(d.date).toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })
              return (
                <div key={d.date} className="flex items-center gap-3 text-sm">
                  <span className="text-stone-500 w-20 text-xs shrink-0">{dateStr}</span>
                  <div className="flex-1 h-6 bg-stone-900 rounded-lg overflow-hidden relative">
                    <div
                      className={`h-full rounded-lg transition-all ${
                        aboveTarget ? 'bg-emerald-500/70' : 'bg-amber-500/60'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-px bg-stone-600"
                      style={{ left: `${(objectif / maxCa) * 100}%` }}
                    />
                  </div>
                  <span className={`w-16 text-right text-xs font-medium ${
                    aboveTarget ? 'text-emerald-400' : 'text-stone-300'
                  }`}>
                    {formatEur(d.ca)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Emprunt tracker */}
      <div className="card">
        <h3 className="text-stone-400 text-sm font-medium mb-4">Emprunt BNP · 51 000 €</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-stone-400 text-sm">Mensualité</span>
            <span className="text-red-400 font-semibold">{emprunt} €/mois</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400 text-sm">En jours de travail</span>
            <span className="text-stone-200 font-semibold">
              {caMoyen > 0 ? `${(emprunt / caMoyen).toFixed(1)} jours` : '--'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400 text-sm">% du CA mensuel proj.</span>
            <span className={`font-semibold ${
              caMoyen > 0 ? ((emprunt / caProjeteMois) < 0.1 ? 'text-emerald-400' : 'text-amber-400') : 'text-stone-400'
            }`}>
              {caMoyen > 0 ? `${((emprunt / caProjeteMois) * 100).toFixed(1)}%` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Événements à surveiller */}
      {events.length > 0 && (
        <div className="card">
          <h3 className="text-stone-300 font-medium mb-3">Événements à surveiller</h3>
          <div className="space-y-2">
            {events.map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-stone-500 w-16 shrink-0 text-xs">
                  {e.date.slice(5).replace('-', '/')}
                </span>
                <span className="text-stone-300 flex-1">{e.description}</span>
                <span className={`font-bold text-xs ${
                  e.impact === 'positif' ? 'text-emerald-400' :
                  e.impact === 'negatif' ? 'text-red-400' : 'text-stone-400'
                }`}>
                  {e.impact === 'positif' ? '↑' : e.impact === 'negatif' ? '↓' : '→'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
