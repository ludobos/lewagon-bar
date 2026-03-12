'use client'

import { useState, useRef, useEffect } from 'react'
import DashboardTab from './_tabs/DashboardTab'
import CaTab from './_tabs/CaTab'
import FacturesTab from './_tabs/FacturesTab'
import ArticlesTab from './_tabs/ArticlesTab'
import EventsTab from './_tabs/EventsTab'
import TravauxTab from './_tabs/TravauxTab'
import AssistantTab from './_tabs/AssistantTab'

type Section = 'accueil' | 'ca' | 'factures' | 'articles' | 'events' | 'travaux' | 'assistant'

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'accueil', label: 'Accueil', icon: '📊' },
  { id: 'ca', label: 'CA 30 jours', icon: '📈' },
  { id: 'factures', label: 'Factures', icon: '📄' },
  { id: 'articles', label: 'Articles', icon: '📊' },
  { id: 'events', label: 'Événements', icon: '📅' },
  { id: 'travaux', label: 'Impact travaux', icon: '🚧' },
  { id: 'assistant', label: 'Assistant IA', icon: '🤖' },
]

export default function GestionPage() {
  const [section, setSection] = useState<Section>('accueil')
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const current = SECTIONS.find(s => s.id === section)!

  // Fermer le menu si clic en dehors
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="space-y-4">
      {/* Dropdown menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'var(--bg-card)', color: 'var(--gold)', border: '1px solid #444' }}
        >
          <span>{current.icon} {current.label}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
        </button>

        {open && (
          <div
            className="absolute left-4 right-4 mt-1 rounded-xl overflow-hidden shadow-lg"
            style={{ background: 'var(--bg-card)', border: '1px solid #444', zIndex: 50 }}
          >
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => { setSection(s.id); setOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left"
                style={{
                  background: s.id === section ? 'rgba(212,165,116,0.15)' : 'transparent',
                  color: s.id === section ? 'var(--gold)' : 'var(--text-secondary)',
                  borderBottom: '1px solid #333',
                }}
              >
                <span className="text-base">{s.icon}</span>
                <span className="font-medium">{s.label}</span>
                {s.id === section && <span className="ml-auto text-xs" style={{ color: 'var(--gold)' }}>●</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Raccourci Assistant IA */}
      {section !== 'assistant' && (
        <button
          onClick={() => setSection('assistant')}
          className="fixed bottom-6 right-6 z-10 w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg transition-transform active:scale-90"
          style={{ background: 'var(--gold)', color: 'var(--bg-dark)' }}
          title="Assistant IA"
        >
          🤖
        </button>
      )}

      {/* Tab content */}
      {section === 'accueil' && <DashboardTab />}
      {section === 'ca' && <CaTab />}
      {section === 'factures' && <FacturesTab />}
      {section === 'articles' && <ArticlesTab />}
      {section === 'events' && <EventsTab />}
      {section === 'travaux' && <TravauxTab />}
      {section === 'assistant' && <AssistantTab />}
    </div>
  )
}
