'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const TABS = [
  { href: '/admin/dashboard', icon: '📊', label: 'Accueil' },
  { href: '/admin/caisse', icon: '🧾', label: 'Caisse' },
  { href: '/admin/factures', icon: '📄', label: 'Factures' },
  { href: '/admin/events', icon: '📅', label: 'Events' },
  { href: '/admin/assistant', icon: '🤖', label: 'Assistant' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: 'var(--bg-dark)' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between" style={{ background: 'var(--bg-card)', borderBottom: '1px solid #333' }}>
        <div>
          <h1 className="playfair text-xl font-bold leading-none" style={{ color: 'var(--gold)' }}>Le Wagon</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>22 quai de la Fosse, Nantes</p>
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
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-lg mx-auto px-4 py-4">
          {children}
        </div>
      </main>

      {/* Bottom tab navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-10" style={{ background: 'var(--bg-card)', borderTop: '1px solid #333' }}>
        <div className="max-w-lg mx-auto flex">
          {TABS.map(tab => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors"
                style={{ color: active ? 'var(--gold)' : 'var(--text-muted)' }}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="text-[10px] font-medium">{tab.label}</span>
                {active && <span className="w-1 h-1 rounded-full" style={{ background: 'var(--gold)' }} />}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
