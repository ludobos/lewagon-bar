'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const TABS = [
  { href: '/admin/dashboard', icon: '📊', label: 'Accueil' },
  { href: '/admin/gestion', icon: '📈', label: 'Gestion' },
  { href: '/admin/assistant', icon: '🤖', label: 'Assistant' },
]

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Tableau de bord',
  '/admin/gestion': 'Gestion',
  '/admin/assistant': 'Assistant',
  '/admin/events': 'Événements',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const pageTitle = PAGE_TITLES[pathname] || 'Le Wagon'

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: 'var(--bg-dark)' }}>
      {/* Top bar — contextuel */}
      <header className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between" style={{ background: 'var(--bg-card)', borderBottom: '1px solid #333' }}>
        <div className="flex items-center gap-3">
          <span className="playfair text-lg font-bold leading-none" style={{ color: 'var(--gold)' }}>Le Wagon</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{pageTitle}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm p-1 transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          Déco
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-lg mx-auto px-4 py-4">
          {children}
        </div>
      </main>

      {/* Bottom tab — 3 onglets */}
      <nav className="fixed bottom-0 left-0 right-0 z-10" style={{ background: 'var(--bg-card)', borderTop: '1px solid #333' }}>
        <div className="max-w-lg mx-auto flex">
          {TABS.map(tab => {
            const active = pathname === tab.href || (tab.href === '/admin/gestion' && pathname === '/admin/events')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors"
                style={{ color: active ? 'var(--gold)' : 'var(--text-muted)' }}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="text-[11px] font-medium">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
