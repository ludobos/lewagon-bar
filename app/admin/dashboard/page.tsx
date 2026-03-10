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

function formatEur(n: number) {
  return Math.round(n).toLocaleString('fr-FR') + ' €'
}

export default async function DashboardPage() {
  const [stats, days] = await Promise.all([getStats(), getLast21Days()])

  const caMoyen = stats.ca_moyen || 0
  const objectif = 1750
  const ratio = caMoyen / objectif
  const caProjeteMois = caMoyen * 20
  const emprunt = 730
  const maxCa = Math.max(...days.map((d: any) => d.ca), objectif)

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-amber-400">Tableau de bord</h1>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <div className={`stat-value ${ratio >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatEur(caMoyen)}
          </div>
          <div className="stat-label">CA moyen / jour</div>
          <div className="text-stone-600 text-xs mt-1">obj. {formatEur(objectif)}</div>
        </div>

        <div className="card text-center">
          <div className="stat-value text-stone-100">{formatEur(caProjeteMois)}</div>
          <div className="stat-label">CA projeté / mois</div>
          <div className="text-stone-600 text-xs mt-1">sur 20 jours</div>
        </div>

        <div className="card text-center">
          <div className={`stat-value ${caProjeteMois >= emprunt * 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {formatEur(emprunt)}
          </div>
          <div className="stat-label">Emprunt / mois</div>
          <div className="text-stone-600 text-xs mt-1">51 000 € BNP</div>
        </div>
      </div>

      {/* Stats résumé */}
      <div className="card">
        <div className="flex justify-between text-sm">
          <span className="text-stone-400">Jours enregistrés</span>
          <span>{stats.nb_jours}</span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-stone-400">Objectif atteint</span>
          <span className={stats.jours_objectif > 0 ? 'text-emerald-400' : 'text-stone-500'}>
            {stats.jours_objectif} / {stats.nb_jours} jours
          </span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-stone-400">Record</span>
          <span className="text-amber-400">{formatEur(stats.ca_max)}</span>
        </div>
      </div>

      {/* 21 derniers jours */}
      <div>
        <h2 className="text-sm font-semibold text-stone-400 mb-3">21 derniers jours</h2>
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
                    {/* Ligne objectif */}
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
    </div>
  )
}
