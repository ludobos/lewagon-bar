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
    <div className="min-h-screen flex flex-col bg-stone-950">
      {/* Top bar */}
      <header className="bg-stone-900 border-b border-stone-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="playfair text-2xl text-amber-400 font-bold leading-none">Le Wagon</h1>
          <p className="text-stone-500 text-xs mt-0.5">22 quai de la Fosse, Nantes</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-stone-600 hover:text-stone-400 text-sm p-1"
        >
          Déco
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-lg mx-auto px-4 py-5">
          {children}
        </div>
      </main>

      {/* Bottom tab navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-stone-900 border-t border-stone-800 z-10">
        <div className="max-w-lg mx-auto flex">
          {TABS.map(tab => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
                  active ? 'text-amber-400' : 'text-stone-600 hover:text-stone-400'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="text-xs font-medium">{tab.label}</span>
                {active && <span className="w-1 h-1 rounded-full bg-amber-400 mt-0.5" />}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
