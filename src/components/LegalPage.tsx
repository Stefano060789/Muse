import Link from 'next/link'
import type { ReactNode } from 'react'

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: '#f7f3ed', color: '#2d2926', fontFamily: 'Georgia, serif', padding: '1.5rem' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <header style={{ marginBottom: '2rem' }}>
          <Link href="/" style={{ color: 'inherit', fontWeight: 700 }}>MUSE</Link>
        </header>
        <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 3.5rem)', lineHeight: 1.1 }}>{title}</h1>
        <div style={{ lineHeight: 1.75 }}>{children}</div>
      </div>
    </main>
  )
}
