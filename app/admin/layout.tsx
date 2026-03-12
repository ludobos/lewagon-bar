'use client'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect } from 'react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: pathname }),
    }).catch(() => {})
  }, [pathname])

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: 'var(--bg-dark)' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between" style={{ background: 'var(--bg-card)', borderBottom: '1px solid #333' }}>
        <span className="playfair text-lg font-bold leading-none" style={{ color: 'var(--gold)' }}>Le Wagon</span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm p-1 transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          Déco
        </button>
      </header>

      {/* Content — plus de pb-20 car plus de nav bar en bas */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-4">
          {children}
        </div>
      </main>
    </div>
  )
}
