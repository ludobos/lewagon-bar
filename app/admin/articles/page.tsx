'use client'

import { useState, useEffect } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  BarChart,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

/* ── Design tokens ─────────────────────────────────────── */
const C = {
  bg: '#0c1117',
  card: '#151d28',
  accent: '#e8913a',
  green: '#34d399',
  red: '#f87171',
  blue: '#60a5fa',
  purple: '#a78bfa',
  cyan: '#22d3ee',
  pink: '#ec4899',
  yellow: '#fbbf24',
  text: '#e2e8f0',
  muted: '#7a8ba3',
  border: '#1e2d3d',
}

const CAT_COLORS: Record<string, string> = {
  'Boissons chaudes': C.yellow,
  'Bières pressions': C.accent,
  'Vins': C.purple,
  'Sodas': C.cyan,
  'Cocktails': C.pink,
  'Snack': C.green,
  'Apéritifs': C.blue,
  'Digestifs': '#c084fc',
  'Non attribué': C.muted,
}

function catColor(cat: string) {
  return CAT_COLORS[cat] || C.muted
}

/* ── Types ─────────────────────────────────────────────── */
type Article = {
  name: string
  qty: number
  ca: number
  prix: number
  cat: string
  vel: number
}

type Category = {
  name: string
  ca: number
  qty: number
  refs: number
  prixMoy: number
  pct: number
}

type ParetoItem = {
  name: string
  ca: number
  cumulPct: number
}

type Meta = {
  dateRange: { from: string; to: string }
  nbDays: number
  nbTransactions: number
  txWithProducts: number
  coverage: number
  totalCA: number
  realCA: number
  totalQty: number
}

type ApiResponse = {
  articles: Article[]
  categories: Category[]
  pareto: ParetoItem[]
  meta: Meta
}

/* ── Helpers ───────────────────────────────────────────── */
function fmt(n: number) {
  return Math.round(n).toLocaleString('fr-FR')
}

/* ── Tabs ──────────────────────────────────────────────── */
type Tab = 'pareto' | 'articles' | 'families' | 'insights'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'pareto', label: 'Pareto', icon: '📊' },
  { id: 'articles', label: 'Articles', icon: '📋' },
  { id: 'families', label: 'Familles', icon: '🗂️' },
  { id: 'insights', label: 'Insights', icon: '💡' },
]

/* ── Custom Tooltip ────────────────────────────────────── */
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: C.text, fontWeight: 600, fontSize: 13, margin: 0 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.dataKey === 'cumulPct' ? C.green : C.accent, fontSize: 12, margin: '2px 0 0' }}>
          {p.dataKey === 'cumulPct' ? `${p.value}%` : `${fmt(p.value)} €`}
        </p>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */
export default function ArticlesPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('pareto')

  // Articles tab state
  const [catFilter, setCatFilter] = useState<string>('Tous')
  const [sortKey, setSortKey] = useState<'ca' | 'qty' | 'vel' | 'prix'>('ca')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  useEffect(() => {
    fetch('/api/articles')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((d: ApiResponse) => {
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  /* ── Loading ───────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: 'spin 1s linear infinite' }}>🚂</div>
          <p style={{ color: C.muted, fontSize: 14 }}>Chargement des articles...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: C.red }}>
          <p style={{ fontSize: 24 }}>⚠️</p>
          <p>{error || 'Données non disponibles'}</p>
        </div>
      </div>
    )
  }

  const { articles, categories, pareto, meta } = data

  /* ── Sorted / filtered articles ────────────────────── */
  const filteredArticles = catFilter === 'Tous'
    ? [...articles]
    : articles.filter((a) => a.cat === catFilter)
  filteredArticles.sort((a, b) => sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey])

  const allCats = ['Tous', ...categories.map((c) => c.name)]

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  /* ── Top 6 for pareto detail ───────────────────────── */
  const top6 = pareto.slice(0, 6)

  /* ── Absent products (low velocity) ────────────────── */
  const absents = articles.filter((a) => a.vel < 1).sort((a, b) => a.vel - b.vel)

  /* ── Render ────────────────────────────────────────── */
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          🚂 Le Wagon · Par articles
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, fontSize: 12, color: C.muted }}>
          <span>{meta.dateRange.from} → {meta.dateRange.to}</span>
          <span>·</span>
          <span>{meta.nbDays} jours</span>
          <span>·</span>
          <span>{fmt(meta.realCA)} € CA</span>
          <span>·</span>
          <span>{fmt(meta.totalQty)} articles vendus</span>
          <span>·</span>
          <span style={{ color: meta.coverage < 60 ? C.yellow : C.green }}>
            {meta.coverage}% couverture
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, overflow: 'auto' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '12px 8px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
              color: tab === t.id ? C.accent : C.muted,
              fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
        {tab === 'pareto' && (
          <ParetoTab pareto={pareto} top6={top6} absents={absents} meta={meta} />
        )}
        {tab === 'articles' && (
          <ArticlesTab
            articles={filteredArticles}
            allCats={allCats}
            catFilter={catFilter}
            setCatFilter={setCatFilter}
            sortKey={sortKey}
            sortDir={sortDir}
            toggleSort={toggleSort}
            meta={meta}
          />
        )}
        {tab === 'families' && (
          <FamiliesTab categories={categories} meta={meta} />
        )}
        {tab === 'insights' && (
          <InsightsTab meta={meta} categories={categories} articles={articles} />
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   PARETO TAB
   ══════════════════════════════════════════════════════════ */
function ParetoTab({
  pareto,
  top6,
  absents,
  meta,
}: {
  pareto: ParetoItem[]
  top6: ParetoItem[]
  absents: Article[]
  meta: Meta
}) {
  const chartData = pareto.slice(0, 20).map((p) => ({
    name: p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name,
    ca: p.ca,
    cumulPct: p.cumulPct,
  }))

  return (
    <div>
      {/* Pareto Chart */}
      <div style={{ background: C.card, borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid ${C.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: C.text }}>
          Courbe de Pareto — Top 20
        </h3>
        <p style={{ fontSize: 11, color: C.muted, margin: '0 0 12px' }}>
          CA par article + % cumulé du CA total
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: C.muted }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: C.muted }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: C.muted }} domain={[0, 100]} unit="%" />
            <Tooltip content={<CustomTooltip />} />
            <Bar yAxisId="left" dataKey="ca" fill={C.accent} radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cumulPct" stroke={C.green} strokeWidth={2} dot={{ r: 3, fill: C.green }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Top 6 detail cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        {top6.map((item, i) => (
          <div
            key={item.name}
            style={{
              background: C.card,
              borderRadius: 10,
              padding: 12,
              border: `1px solid ${C.border}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 10,
                fontSize: 28,
                fontWeight: 800,
                color: C.border,
                lineHeight: 1,
              }}
            >
              #{i + 1}
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: C.text }}>{item.name}</p>
            <p style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 2px', color: C.accent }}>
              {fmt(item.ca)} €
            </p>
            <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>
              {item.cumulPct}% du CA cumulé
            </p>
          </div>
        ))}
      </div>

      {/* Absents alert */}
      {absents.length > 0 && (
        <div
          style={{
            background: 'rgba(248,113,113,0.08)',
            borderRadius: 12,
            padding: 14,
            border: `1px solid rgba(248,113,113,0.2)`,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px', color: C.red }}>
            ⚠️ Articles quasi absents ({absents.length})
          </h3>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px' }}>
            Moins d{"'"}1 vente/jour — à surveiller ou retirer de la carte
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {absents.slice(0, 15).map((a) => (
              <span
                key={a.name}
                style={{
                  fontSize: 11,
                  background: 'rgba(248,113,113,0.12)',
                  color: C.red,
                  padding: '3px 8px',
                  borderRadius: 6,
                }}
              >
                {a.name} ({a.qty})
              </span>
            ))}
            {absents.length > 15 && (
              <span style={{ fontSize: 11, color: C.muted }}>+{absents.length - 15} autres</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   ARTICLES TAB
   ══════════════════════════════════════════════════════════ */
function ArticlesTab({
  articles,
  allCats,
  catFilter,
  setCatFilter,
  sortKey,
  sortDir,
  toggleSort,
  meta,
}: {
  articles: Article[]
  allCats: string[]
  catFilter: string
  setCatFilter: (v: string) => void
  sortKey: string
  sortDir: string
  toggleSort: (k: 'ca' | 'qty' | 'vel' | 'prix') => void
  meta: Meta
}) {
  const arrow = (key: string) => (sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '')

  return (
    <div>
      {/* Category filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {allCats.map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              border: `1px solid ${catFilter === cat ? C.accent : C.border}`,
              background: catFilter === cat ? C.accent : 'transparent',
              color: catFilter === cat ? '#000' : C.muted,
              fontSize: 12,
              fontWeight: catFilter === cat ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Count */}
      <p style={{ fontSize: 12, color: C.muted, margin: '0 0 8px' }}>
        {articles.length} article{articles.length > 1 ? 's' : ''}
      </p>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ textAlign: 'left', padding: '8px 6px', color: C.muted, fontWeight: 500 }}>Article</th>
              <th
                style={{ textAlign: 'right', padding: '8px 6px', color: C.muted, fontWeight: 500, cursor: 'pointer' }}
                onClick={() => toggleSort('ca')}
              >
                CA{arrow('ca')}
              </th>
              <th
                style={{ textAlign: 'right', padding: '8px 6px', color: C.muted, fontWeight: 500, cursor: 'pointer' }}
                onClick={() => toggleSort('qty')}
              >
                Qté{arrow('qty')}
              </th>
              <th
                style={{ textAlign: 'right', padding: '8px 6px', color: C.muted, fontWeight: 500, cursor: 'pointer' }}
                onClick={() => toggleSort('prix')}
              >
                Prix{arrow('prix')}
              </th>
              <th
                style={{ textAlign: 'right', padding: '8px 6px', color: C.muted, fontWeight: 500, cursor: 'pointer' }}
                onClick={() => toggleSort('vel')}
              >
                Vel/j{arrow('vel')}
              </th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr
                key={a.name}
                style={{
                  borderBottom: `1px solid ${C.border}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(232,145,58,0.05)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
              >
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: catColor(a.cat),
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontWeight: 500 }}>{a.name}</span>
                  </div>
                  <span style={{ fontSize: 10, color: C.muted, marginLeft: 14 }}>{a.cat}</span>
                </td>
                <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: C.accent }}>
                  {fmt(a.ca)} €
                </td>
                <td style={{ textAlign: 'right', padding: '8px 6px' }}>{a.qty}</td>
                <td style={{ textAlign: 'right', padding: '8px 6px' }}>{a.prix.toFixed(2)} €</td>
                <td style={{ textAlign: 'right', padding: '8px 6px' }}>
                  <span
                    style={{
                      color: a.vel >= 10 ? C.green : a.vel >= 3 ? C.yellow : C.red,
                      fontWeight: 500,
                    }}
                  >
                    {a.vel.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   FAMILIES TAB
   ══════════════════════════════════════════════════════════ */
function FamiliesTab({ categories, meta }: { categories: Category[]; meta: Meta }) {
  const chartData = [...categories].sort((a, b) => b.ca - a.ca).map((c) => ({
    name: c.name,
    ca: c.ca,
    fill: catColor(c.name),
  }))

  const pieData = categories.map((c) => ({
    name: c.name,
    value: c.ca,
    fill: catColor(c.name),
  }))

  const insights: Record<string, { emoji: string; text: string; action: string }> = {
    'Boissons chaudes': {
      emoji: '☕',
      text: 'Volume leader. Le café tire les ventes matin/après-midi. Prix moyen bas mais volume énorme.',
      action: 'Optimiser le prix si possible (+0.10€). Proposer des spécialités (latte, chaï).',
    },
    'Bières pressions': {
      emoji: '🍺',
      text: 'Pilier du CA — forte rotation, bonne marge. Les bières artisanales performent bien.',
      action: 'Maintenir les refs actuelles. Tester des rotations saisonnières pour renouveler.',
    },
    'Vins': {
      emoji: '🍷',
      text: 'Bon panier moyen, clientèle fidèle. Le vin au verre représente la majorité.',
      action: 'Carte courte 6-8 refs au verre. Rotation mensuelle pour créer l\'événement.',
    },
    'Sodas': {
      emoji: '🥤',
      text: 'Ventes régulières, accompagnent les repas. Marge correcte sur les sirops maison.',
      action: 'Proposer des softs "signature" (limonade maison, thé glacé). Marge facile.',
    },
    'Cocktails': {
      emoji: '🍹',
      text: 'Meilleur prix moyen mais volume limité. Gros potentiel de croissance le week-end.',
      action: 'Happy hour cocktails. Carte courte (6-8 refs) pour la rapidité de service.',
    },
    'Snack': {
      emoji: '🍴',
      text: 'Complément important. Les planches génèrent des ventes croisées (vin, bière).',
      action: 'Planches simples à préparer. Le ratio effort/marge doit rester bon.',
    },
    'Apéritifs': {
      emoji: '🍸',
      text: 'Classiques indémodables. Ricard, Kir, Martini — fidélisent la clientèle régulière.',
      action: 'Garder les classiques. Proposer un apéro du mois pour varier.',
    },
    'Digestifs': {
      emoji: '🥃',
      text: 'Niche mais haute valeur. Souvent en fin de soirée ou accompagnement.',
      action: 'Pas besoin de gros stock. Mettre en avant 3-4 pépites avec storytelling.',
    },
  }

  return (
    <div>
      {/* Horizontal bar chart */}
      <div style={{ background: C.card, borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid ${C.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: C.text }}>
          CA par famille
        </h3>
        <ResponsiveContainer width="100%" height={categories.length * 40 + 20}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 80, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.text }} width={75} />
            <Tooltip
              formatter={(value) => [`${fmt(Number(value))} €`, 'CA']}
              contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="ca" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie chart */}
      <div style={{ background: C.card, borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid ${C.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: C.text }}>
          Répartition du CA
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${fmt(Number(value))} €`, name]}
              contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 8 }}>
          {pieData.map((p) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill }} />
              <span style={{ color: C.muted }}>{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Family detail cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {categories.map((cat) => {
          const ins = insights[cat.name]
          return (
            <div
              key={cat.name}
              style={{
                background: C.card,
                borderRadius: 12,
                padding: 14,
                border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${catColor(cat.name)}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: C.text }}>
                  {ins?.emoji || '📦'} {cat.name}
                </h4>
                <span style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>{fmt(cat.ca)} €</span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.muted, marginBottom: 8 }}>
                <span>{cat.qty} vendus</span>
                <span>{cat.refs} refs</span>
                <span>Moy: {cat.prixMoy.toFixed(2)} €</span>
                <span style={{ color: C.accent }}>{cat.pct}% du CA</span>
              </div>
              {ins && (
                <>
                  <p style={{ fontSize: 12, color: C.text, margin: '0 0 4px', lineHeight: 1.4 }}>
                    {ins.text}
                  </p>
                  <p style={{ fontSize: 11, color: C.green, margin: 0, lineHeight: 1.4 }}>
                    → {ins.action}
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   INSIGHTS TAB
   ══════════════════════════════════════════════════════════ */
function InsightsTab({ meta, categories, articles }: { meta: Meta; categories: Category[]; articles: Article[] }) {
  const avgTicket = meta.realCA / meta.nbTransactions
  const articlesPerTx = meta.totalQty / meta.txWithProducts
  const caPerDay = meta.realCA / meta.nbDays
  const topCat = [...categories].sort((a, b) => b.ca - a.ca)[0]
  const highVel = articles.filter((a) => a.vel >= 10).length
  const lowVel = articles.filter((a) => a.vel < 1).length

  const diagnostics = [
    {
      label: 'Ticket moyen',
      value: `${avgTicket.toFixed(2)} €`,
      detail: avgTicket < 8 ? 'Bas — pousser les ventes additionnelles' : 'Correct pour un bar',
      color: avgTicket < 8 ? C.yellow : C.green,
    },
    {
      label: 'Articles / ticket',
      value: articlesPerTx.toFixed(1),
      detail: articlesPerTx < 2 ? 'Faible — suggestions croisées à améliorer' : 'Bon ratio multi-produit',
      color: articlesPerTx < 2 ? C.yellow : C.green,
    },
    {
      label: 'CA / jour',
      value: `${fmt(caPerDay)} €`,
      detail: caPerDay < 1500 ? 'Sous objectif (1 500–2 000 €/j)' : 'Dans la cible 👍',
      color: caPerDay < 1500 ? C.red : C.green,
    },
    {
      label: 'Couverture produit',
      value: `${meta.coverage}%`,
      detail: meta.coverage < 70 ? 'SumUp ne renvoie pas tous les détails — compléter manuellement' : 'Bonne couverture',
      color: meta.coverage < 70 ? C.yellow : C.green,
    },
    {
      label: 'Articles haute vélocité (≥10/j)',
      value: `${highVel}`,
      detail: 'Ce sont vos locomotives — ne jamais être en rupture',
      color: C.green,
    },
    {
      label: 'Articles quasi absents (<1/j)',
      value: `${lowVel}`,
      detail: lowVel > 10 ? 'Beaucoup de refs inutiles — simplifier la carte' : 'Carte bien calibrée',
      color: lowVel > 10 ? C.red : C.green,
    },
  ]

  return (
    <div>
      {/* Diagnostics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {diagnostics.map((d) => (
          <div
            key={d.label}
            style={{
              background: C.card,
              borderRadius: 10,
              padding: 14,
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${d.color}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: C.muted }}>{d.label}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: d.color }}>{d.value}</span>
            </div>
            <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0', lineHeight: 1.4 }}>{d.detail}</p>
          </div>
        ))}
      </div>

      {/* Top category highlight */}
      {topCat && (
        <div
          style={{
            background: `linear-gradient(135deg, ${C.card}, rgba(232,145,58,0.1))`,
            borderRadius: 12,
            padding: 16,
            border: `1px solid ${C.accent}30`,
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px', color: C.accent }}>
            🏆 Famille n°1 : {topCat.name}
          </h3>
          <p style={{ fontSize: 12, color: C.text, margin: '0 0 4px', lineHeight: 1.5 }}>
            <strong>{fmt(topCat.ca)} €</strong> de CA ({topCat.pct}%) avec {topCat.refs} références.
            Prix moyen : {topCat.prixMoy.toFixed(2)} €.
          </p>
          <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
            C{"'"}est le socle du chiffre. Maintenir la qualité et la diversité de cette famille est prioritaire.
          </p>
        </div>
      )}

      {/* Objectif card */}
      <div
        style={{
          background: C.card,
          borderRadius: 12,
          padding: 16,
          border: `1px solid ${C.border}`,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px', color: C.text }}>
          🎯 Objectifs rapides
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { text: 'Retirer ou remplacer les articles à <1 vente/jour', done: false },
            { text: 'Tester un happy hour cocktails le jeudi soir', done: false },
            { text: 'Ajouter 2 softs "signature" (limonade, thé glacé)', done: false },
            { text: 'Suivre le ticket moyen semaine par semaine', done: false },
            { text: 'Toujours passer les commandes par la caisse SumUp', done: false },
          ].map((obj, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: `1.5px solid ${obj.done ? C.green : C.border}`,
                  background: obj.done ? C.green : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#000',
                  flexShrink: 0,
                }}
              >
                {obj.done ? '✓' : ''}
              </span>
              <span style={{ color: C.text }}>{obj.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
