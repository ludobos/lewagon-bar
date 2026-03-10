import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Le Wagon — Pilotage',
  description: 'Tableau de bord — Le Wagon, 22 quai de la Fosse Nantes',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Le Wagon' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0c0a09',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-stone-950 text-stone-100 antialiased">{children}</body>
    </html>
  )
}
