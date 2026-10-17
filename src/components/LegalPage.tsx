import type { ReactNode } from 'react'

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="atelier-page">
      <div className="atelier-shell atelier-shell--narrow">
        <p className="atelier-eyebrow">Help and information</p>
        <h1 className="atelier-title">{title}</h1>
        <div className="atelier-card" style={{ lineHeight: 1.75 }}>{children}</div>
      </div>
    </main>
  )
}
