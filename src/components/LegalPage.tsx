import Link from 'next/link'
import type { ReactNode } from 'react'

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="atelier-page">
      <div className="atelier-shell atelier-shell--narrow">
        <header className="atelier-header">
          <Link href="/" className="atelier-brand">Muse</Link>
          <Link href="/support">Support</Link>
        </header>
        <p className="atelier-eyebrow">The practical pages</p>
        <h1 className="atelier-title">{title}</h1>
        <div className="atelier-card" style={{ lineHeight: 1.75 }}>{children}</div>
      </div>
    </main>
  )
}
